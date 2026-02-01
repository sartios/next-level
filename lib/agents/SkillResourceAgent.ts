import assert from 'node:assert';
import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { searchCuratedResourcesTool } from '@/lib/tools/searchCuratedResourcesTool';
import { Goal, User } from '@/lib/mockDb';
import { GoalResourceSchema, LearningResourceWithSectionsSchema } from '@/lib/schemas';
import { getAgentPrompt } from '@/lib/prompts';
import { GoalResource, LearningResourceWithSections } from '../types';
import { getLearningResourcesWithSections } from '../db/resourceRepository';

export interface RetrieverOutput {
  resources: LearningResourceWithSections[];
}

const RetrieveOperationOutputSchema = z.object({
  resources: z.array(z.string())
});

export const RetrieverOutputSchema = z.object({
  resources: z.array(LearningResourceWithSectionsSchema)
});

export interface EvaluatorOutput {
  resources: GoalResource[];
}

const EvaluateOperationOutputSchema = z.object({
  resources: z.array(
    z.object({
      id: z.string().describe('Resource ID'),
      relevancePercentage: z.string().describe('Relevance percentage to the overall user profile and goal'),
      reasoning: z.string().describe('The reason of why it is relevant')
    })
  )
});

export const EvaluatorOutputSchema = z.object({
  resources: z.array(GoalResourceSchema)
});

class SkillResourceAgent {
  private readonly agentName = 'skill-resource-agent';

  private readonly retrieverModel = 'gpt-5-nano';
  private agentRetriever: ReturnType<typeof createAgent> | null = null;
  private initRetrieverPromise: Promise<void> | null = null;

  private readonly evaluatorModel = 'gpt-5-mini';
  private agentEvaluator: ReturnType<typeof createAgent> | null = null;
  private initEvaluatorPromise: Promise<void> | null = null;

  private async initializeRetriever(): Promise<void> {
    if (this.agentRetriever) return;

    if (!this.initRetrieverPromise) {
      this.initRetrieverPromise = (async () => {
        try {
          const systemPrompt = await getAgentPrompt('skill-resource-agent:retrieve:system-prompt');
          this.agentRetriever = createAgent({
            model: new ChatOpenAI({ model: this.retrieverModel }),
            tools: [searchCuratedResourcesTool],
            systemPrompt: new SystemMessage(systemPrompt),
            responseFormat: providerStrategy(RetrieveOperationOutputSchema)
          });
        } catch (error) {
          this.initRetrieverPromise = null;
          throw error;
        }
      })();
    }

    await this.initRetrieverPromise;
  }

  private async initializeEvaluator(): Promise<void> {
    if (this.agentEvaluator) return;

    if (!this.initEvaluatorPromise) {
      this.initEvaluatorPromise = (async () => {
        try {
          const systemPrompt = await getAgentPrompt('skill-resource-agent:evaluate:system-prompt');
          this.agentEvaluator = createAgent({
            model: new ChatOpenAI({ model: this.evaluatorModel }),
            tools: [],
            systemPrompt: new SystemMessage(systemPrompt),
            responseFormat: providerStrategy(EvaluateOperationOutputSchema)
          });
        } catch (error) {
          this.initEvaluatorPromise = null;
          throw error;
        }
      })();
    }

    await this.initEvaluatorPromise;
  }

  /**
   * Retrieve resources from the curated database using RAG.
   * This is the first step in the resource suggestion pipeline.
   */
  public async retrieve(user: User, goal: Goal, opikOptions?: OpikHandlerOptions): Promise<RetrieverOutput> {
    await this.initializeRetriever();
    assert(this.agentRetriever, `${this.agentName} retriever not ready`);

    const retrieverHandler = createOpikHandler({
      tags: [this.agentName, 'operation:retrieve', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId: user.id,
        goalId: goal.id,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const retrieverUserPrompt = await getAgentPrompt('skill-resource-agent:retrieve:user-prompt', {
      user_profile_json: JSON.stringify({ role: user.role, skills: user.skills, careerGoals: user.careerGoals }),
      growth_goal_json: JSON.stringify({ name: goal.name, reasoning: goal.reasoning })
    });
    const result = await this.agentRetriever.invoke(
      { messages: [new HumanMessage(retrieverUserPrompt)] },
      { callbacks: [retrieverHandler], runName: `${this.agentName}:retrieve` }
    );

    const resources = await getLearningResourcesWithSections(result.structuredResponse.resources);

    return { resources };
  }

  /**
   * Evaluate and filter retrieved resources based on relevance to the user and goal.
   * This is the second step in the resource suggestion pipeline.
   */
  public async evaluate(
    user: User,
    goal: Goal,
    retrievedResources: LearningResourceWithSections[],
    opikOptions?: OpikHandlerOptions
  ): Promise<EvaluatorOutput> {
    await this.initializeEvaluator();
    assert(this.agentEvaluator, `${this.agentName} evaluator not ready`);

    const evaluatorHandler = createOpikHandler({
      tags: [this.agentName, 'operation:evaluate', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId: user.id,
        goalId: goal.id,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const evaluatorUserPrompt = await getAgentPrompt('skill-resource-agent:evaluate:user-prompt', {
      user_profile_json: JSON.stringify(user),
      growth_goal_json: JSON.stringify(goal),
      retrieved_candidates_json: JSON.stringify(retrievedResources)
    });
    const result = await this.agentEvaluator.invoke(
      { messages: [new HumanMessage(evaluatorUserPrompt)] },
      { callbacks: [evaluatorHandler], runName: `${this.agentName}:evaluate` }
    );

    const evaluatorOutputResources = result.structuredResponse.resources;
    const learningResources = await getLearningResourcesWithSections(
      evaluatorOutputResources.map((resource: { id: string }) => resource.id)
    );
    const resources = learningResources.map((learningResource) => {
      const evaluatorResource = evaluatorOutputResources.find((r: { id: string }) => r.id === learningResource.id);
      const { relevancePercentage, reasoning } = evaluatorResource;

      return { ...learningResource, relevancePercentage, reasoning } as GoalResource;
    });

    return { resources };
  }

  /**
   * Combined method that runs both retrieve and evaluate steps.
   * Use this for the full resource suggestion pipeline.
   * Creates a parent trace that encompasses both retriever and evaluator operations.
   */
  public async suggestResources(user: User, goal: Goal, opikOptions?: OpikHandlerOptions): Promise<EvaluatorOutput> {
    const threadId = Date.now().toString();
    // Use parent trace ID as threadId to group all sub-traces together
    const opikHandlerOptions: OpikHandlerOptions = {
      ...opikOptions,
      tags: [this.agentName, 'operation:suggest', ...(opikOptions?.tags || [])],
      threadId,
      metadata: {
        ...opikOptions?.metadata
      }
    };

    const { resources } = await this.retrieve(user, goal, opikHandlerOptions);
    return this.evaluate(user, goal, resources, opikHandlerOptions);
  }
}

const skillResourceAgentInstance = new SkillResourceAgent();
export default skillResourceAgentInstance;
