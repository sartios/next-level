import { createAgent, providerStrategy } from 'langchain';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { OpikHandlerOptions, createAgentTrace, getOpikClient } from '@/lib/opik';
import { NextLevelOpikCallbackHandler } from '@/lib/trace/handler';
import { searchCuratedResourcesTool, searchCuratedResources } from '@/lib/tools/searchCuratedResourcesTool';
import { LearningResourceWithSectionsSchema } from '@/lib/schemas';
import { LearningResourceWithSections } from '../types';
import { BaseAgent } from './BaseAgent';
import { createLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';
import { getAgentPrompt } from '@/lib/prompts';
import { User } from '../db/userRepository';
import { Goal } from '../db/goalRepository';

function buildUserPrompt(user: User, goal: Goal): string {
  return `user:\`\`\`json${JSON.stringify({ role: user.role, skills: user.skills.join(','), careerGoals: user.careerGoals.join(',') })}\`\`\` goal:\`\`\`json${JSON.stringify({ name: goal.name, reasoning: goal.reasoning })}\`\`\``;
}

function buildQueryGenerationUserPrompt(user: User, goal: Goal): string {
  return `User Profile:
- Role: ${user.role}
- Current Skills: ${user.skills.join(', ')}
- Career Goals: ${user.careerGoals.join(', ')}

Learning Goal: ${goal.name}
Goal Reasoning: ${goal.reasoning}

Generate 3-5 search queries to find the most relevant learning resources for this user's goal.`;
}

const SearchQueriesSchema = z.object({
  queries: z.array(z.string()).min(1).max(5).describe('Search queries to find relevant learning resources')
});

export interface RetrieverOutput {
  resources: LearningResourceWithSections[];
}

const RetrieveOperationOutputSchema = z.object({
  resources: z.array(LearningResourceWithSectionsSchema)
});

export const RetrieverOutputSchema = RetrieveOperationOutputSchema;

type RetrieverAgentType = ReturnType<typeof createAgent>;

class SkillResourceRetrieverAgent extends BaseAgent<RetrieverAgentType> {
  protected readonly agentName = 'skill-resource-retriever-agent';

  protected async createAgent(): Promise<RetrieverAgentType> {
    const systemPrompt = await getAgentPrompt('skill-resource-retriever-agent:system-prompt');
    return createAgent({
      model: createLLM('gpt-5-nano'),
      tools: [searchCuratedResourcesTool],
      systemPrompt: new SystemMessage(systemPrompt),
      responseFormat: providerStrategy(RetrieveOperationOutputSchema)
    });
  }

  /**
   * Retrieve resources from the curated database using RAG.
   * This is the first step in the resource suggestion pipeline.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async retrieve(user: any, goal: any, opikOptions?: OpikHandlerOptions): Promise<RetrieverOutput> {
    await this.ensureInitialized();
    const agent = this.getAgent();

    const handler = createAgentOpikHandler(this.agentName, 'retrieve', { userId: user.id, goalId: goal.id }, opikOptions);
    const userPrompt = buildUserPrompt(user, goal);

    const result = await agent.invoke(
      { messages: [new HumanMessage(userPrompt)] },
      { callbacks: [handler], runName: `${this.agentName}:retrieve` }
    );

    return { resources: result.structuredResponse.resources };
  }

  public async *streamResources(user: User, goal: Goal, opikOptions?: OpikHandlerOptions): AsyncGenerator<GoalResourceStreamEvent> {
    if (!user) {
      throw new Error('User is required');
    }
    const userId = user.id;

    if (!goal) {
      throw new Error('Goal is required');
    }
    const goalId = goal.id;

    const emittedResources: LearningResourceWithSections[] = [];
    const seenResourceIds = new Set<string>();

    const trace = createAgentTrace(this.agentName, 'stream', {
      input: { role: user.role, skills: user.skills, careerGoals: user.careerGoals, goalName: goal.name, reasoning: goal.reasoning },
      metadata: { userId, goalId, ...opikOptions?.metadata },
      tags: opikOptions?.tags,
      threadId: opikOptions?.threadId
    });

    try {
      // Step 1: Generate search queries using LLM
      yield { type: 'token', userId, goalId, content: 'Generating search queries...' };

      const queryLLM = createLLM('gpt-4o-mini');
      const queryUserPrompt = buildQueryGenerationUserPrompt(user, goal);
      const queryGenerationSystemPrompt = await getAgentPrompt('skill-resource-retriever-agent:query-generation-system-prompt');

      const usageCapture = new NextLevelOpikCallbackHandler({ parent: trace });
      const queryResponse = await queryLLM.invoke([new SystemMessage(queryGenerationSystemPrompt), new HumanMessage(queryUserPrompt)], {
        callbacks: [usageCapture],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'search_queries',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                queries: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Search queries to find relevant learning resources'
                }
              },
              required: ['queries'],
              additionalProperties: false
            }
          }
        }
      });

      const parsedQueries = SearchQueriesSchema.safeParse(
        JSON.parse(typeof queryResponse.content === 'string' ? queryResponse.content : '')
      );

      if (!parsedQueries.success) {
        throw new Error('Failed to generate search queries');
      }

      const queries = parsedQueries.data.queries.slice(0, 5);

      // Step 2: Execute each search query and stream results
      for (const query of queries) {
        // Stream what we're searching for
        yield {
          type: 'token',
          userId,
          goalId,
          toolName: 'searchCuratedResources',
          content: `Searching: "${query}"`,
          input: { query }
        };

        const toolSpan = trace?.span({
          name: 'search-curated-resources',
          type: 'tool',
          input: { query }
        });

        // Execute the search
        const resources = await searchCuratedResources(query, 3);

        toolSpan?.update({ output: { resultCount: resources.length, resources }, endTime: new Date() });

        // Stream each resource one-by-one
        for (const resource of resources) {
          if (seenResourceIds.has(resource.id)) continue;
          seenResourceIds.add(resource.id);
          emittedResources.push(resource);
          yield { type: 'resource', userId, goalId, resource };
        }

        // Stop if we have enough resources
        if (emittedResources.length >= 5) {
          break;
        }
      }

      trace?.update({ output: { resourceCount: emittedResources.length, resources: emittedResources }, endTime: new Date() });

      yield {
        type: 'complete',
        userId,
        goalId,
        result: { resources: emittedResources }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      trace?.update({
        errorInfo: {
          exceptionType: err instanceof Error ? err.constructor.name : 'Error',
          message,
          traceback: err instanceof Error ? err.stack || '' : ''
        },
        endTime: new Date()
      });
      yield { type: 'token', userId, goalId, content: `__stream_error__: ${message}` };
      throw err;
    } finally {
      await getOpikClient()?.flush();
    }
  }
}

export interface GoalResourceStreamEvent {
  type: 'token' | 'resource' | 'complete';
  content?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  userId: string;
  goalId: string;
  resource?: LearningResourceWithSections;
  result?: RetrieverOutput;
}

const skillResourceRetrieverAgentInstance = new SkillResourceRetrieverAgent();
export default skillResourceRetrieverAgentInstance;
