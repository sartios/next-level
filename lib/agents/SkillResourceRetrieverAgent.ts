import { createAgent, providerStrategy } from 'langchain';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { OpikHandlerOptions } from '@/lib/opik';
import { searchCuratedResourcesTool, searchCuratedResources } from '@/lib/tools/searchCuratedResourcesTool';
import { LearningResourceWithSectionsSchema } from '@/lib/schemas';
import { LearningResourceWithSections } from '../types';
import { BaseAgent } from './BaseAgent';
import { createLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';

const SYSTEM_PROMPT = `Assume you are a knowledgeable resource retrieval agent.
Your objective is to assist a user in achieving their career aspirations.
Begin by examining the user's current role and skills outlined as follows: {user.role} and {user.skills}.
Next, evaluate the user's goal, {goal.name}, and its reasoning.
Finally, formulate a targeted search query that aligns with the user's professional development needs.`;

const QUERY_GENERATION_SYSTEM_PROMPT = `You are a learning resource search expert. Given a user's profile and learning goal, generate up to 5 diverse search queries to find relevant learning resources.

Each query should target different aspects of the learning goal:
- Core concepts and fundamentals
- Practical tutorials and hands-on projects
- Advanced techniques and best practices
- Related tools and technologies
- Career-specific applications

Generate queries that would match course titles, descriptions, and learning objectives in a resource database.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUserPrompt(user: any, goal: any): string {
  return `user:\`\`\`json${JSON.stringify({ role: user.role, skills: user.skills.join(','), careerGoals: user.careerGoals.join(',') })}\`\`\` goal:\`\`\`json${JSON.stringify({ name: goal.name, reasoning: goal.reasoning })}\`\`\``;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildQueryGenerationUserPrompt(user: any, goal: any): string {
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
    return createAgent({
      model: createLLM('gpt-5-nano'),
      tools: [searchCuratedResourcesTool],
      systemPrompt: new SystemMessage(SYSTEM_PROMPT),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async *streamResources(user: any, goal: any, opikOptions?: OpikHandlerOptions): AsyncGenerator<GoalResourceStreamEvent> {
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

    // Create Opik handler for tracing
    const handler = createAgentOpikHandler(this.agentName, 'stream', { userId, goalId }, opikOptions);

    try {
      // Step 1: Generate search queries using LLM
      yield { type: 'token', userId, goalId, content: 'Generating search queries...' };

      const queryLLM = createLLM('gpt-4o-mini');
      const queryUserPrompt = buildQueryGenerationUserPrompt(user, goal);

      const queryResponse = await queryLLM.invoke([new SystemMessage(QUERY_GENERATION_SYSTEM_PROMPT), new HumanMessage(queryUserPrompt)], {
        callbacks: [handler],
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

        // Execute the search
        const resources = await searchCuratedResources(query, 3);

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

      yield {
        type: 'complete',
        userId,
        goalId,
        result: { resources: emittedResources }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: 'token', userId, goalId, content: `__stream_error__: ${message}` };
      throw err;
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
