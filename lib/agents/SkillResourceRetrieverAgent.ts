import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { OpikHandlerOptions, createAgentTrace, getOpikClient } from '@/lib/opik';
import { NextLevelOpikCallbackHandler } from '@/lib/trace/handler';
import { searchCuratedResources } from '@/lib/tools/searchCuratedResourcesTool';
import { SearchQueriesSchema, RetrieverOutputSchema } from '@/lib/validation/schemas';
import { LearningResourceWithSections } from '../types';
import { createLLM } from '@/lib/utils/llm';
import { getAgentPrompt } from '@/lib/prompts';
import { User } from '../db/userRepository';
import { Goal } from '../db/goalRepository';
import { parseErrorInfo } from '@/lib/agents/utils';

export { RetrieverOutputSchema };

export interface RetrieverOutput {
  resources: LearningResourceWithSections[];
}

class SkillResourceRetrieverAgent {
  protected readonly agentName = 'skill-resource-retriever-agent';

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
      const queryUserPrompt = await getAgentPrompt('skill-resource-retriever-agent:query-generation-user-prompt', {
        userRole: user.role,
        userSkills: user.skills.join(', '),
        userCareerGoals: user.careerGoals.join(', '),
        goalName: goal.name,
        goalReasoning: goal.reasoning
      });
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

        let resources: LearningResourceWithSections[] | null = null;
        try {
          // Execute the search
          resources = await searchCuratedResources(query, 3);
          toolSpan?.update({
            output: {
              resultCount: resources.length,
              resources: resources.map((r) => ({ id: r.id, title: r.title, provider: r.provider }))
            }
          });
        } catch (error) {
          toolSpan?.update({ errorInfo: parseErrorInfo(error) });
        } finally {
          toolSpan?.update({ endTime: new Date() });
        }

        if (!resources) continue;

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

      trace?.update({
        output: {
          resourceCount: emittedResources.length,
          resources: emittedResources.map((r) => ({ id: r.id, title: r.title, provider: r.provider }))
        }
      });

      yield {
        type: 'complete',
        userId,
        goalId,
        result: { resources: emittedResources }
      };
    } catch (err) {
      const errorInfo = parseErrorInfo(err);
      trace?.update({ errorInfo });
      yield { type: 'token', userId, goalId, content: `__stream_error__: ${errorInfo.message}` };
      throw err;
    } finally {
      trace?.update({ endTime: new Date() });
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
