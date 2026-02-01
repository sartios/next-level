import assert from 'node:assert';
import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { searchCuratedResourcesTool } from '@/lib/tools/searchCuratedResourcesTool';
import { Goal, User } from '@/lib/mockDb';
import { LearningResourceWithSectionsSchema } from '@/lib/schemas';
import { getAgentPrompt } from '@/lib/prompts';
import { LearningResourceWithSections } from '../types';
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

class SkillResourceRetrieverAgent {
  private readonly agentName = 'skill-resource-retriever-agent';

  private readonly retrieverModel = 'gpt-5-nano';
  private agent: ReturnType<typeof createAgent> | null = null;
  private initPromise: Promise<void> | null = null;

  private async initializeAgent(): Promise<void> {
    if (this.agent) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const systemPrompt = await getAgentPrompt('skill-resource-retriever-agent:system-prompt');
          this.agent = createAgent({
            model: new ChatOpenAI({ model: this.retrieverModel }),
            tools: [searchCuratedResourcesTool],
            systemPrompt: new SystemMessage(systemPrompt),
            responseFormat: providerStrategy(RetrieveOperationOutputSchema)
          });
        } catch (error) {
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  /**
   * Retrieve resources from the curated database using RAG.
   * This is the first step in the resource suggestion pipeline.
   */
  public async retrieve(user: User, goal: Goal, opikOptions?: OpikHandlerOptions): Promise<RetrieverOutput> {
    await this.initializeAgent();
    assert(this.agent, `${this.agentName} retriever not ready`);

    const handler = createOpikHandler({
      tags: [this.agentName, 'operation:retrieve', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId: user.id,
        goalId: goal.id,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const retrieverUserPrompt = await getAgentPrompt('skill-resource-retriever-agent:user-prompt', {
      user: JSON.stringify({ role: user.role, skills: user.skills.join(','), careerGoals: user.careerGoals.join(',') }),
      goal: JSON.stringify({ name: goal.name, reasoning: goal.reasoning })
    });
    const result = await this.agent.invoke(
      { messages: [new HumanMessage(retrieverUserPrompt)] },
      { callbacks: [handler], runName: `${this.agentName}:retrieve` }
    );

    const resources = await getLearningResourcesWithSections(result.structuredResponse.resources);

    return { resources };
  }
}

const skillResourceRetrieverAgentInstance = new SkillResourceRetrieverAgent();
export default skillResourceRetrieverAgentInstance;
