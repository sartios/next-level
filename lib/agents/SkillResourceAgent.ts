import assert from 'node:assert';
import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { updateGoalResourcesTool } from '@/lib/tools/updateGoalResourcesTool';
import { Resource, SuggestedSkill } from '@/lib/mockDb';
import { ResourceSchema } from '@/lib/schemas';
import { getAgentPrompt } from '@/lib/prompts';

interface ResourceSuggestionResult {
  goal: Omit<SuggestedSkill, 'priority'>;
  resources: Resource[];
}

const ResourceSuggestionResultSchema = z.object({
  goal: z.object({
    name: z.string(),
    reasoning: z.string()
  }),
  resources: z.array(ResourceSchema)
});

class SkillResourceAgent {
  private readonly agentName = 'skill-resource-agent';
  private readonly model = 'gpt-4o-mini';

  private agent: ReturnType<typeof createAgent> | null = null;
  private initPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.agent) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const systemPrompt = await getAgentPrompt(this.agentName);
          this.agent = createAgent({
            model: new ChatOpenAI({ model: this.model }),
            tools: [fetchUserTool, fetchUserGoalTool, updateGoalResourcesTool],
            systemPrompt: new SystemMessage(systemPrompt),
            responseFormat: providerStrategy(ResourceSuggestionResultSchema)
          });
        } catch (error) {
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  public async suggestResources(userId: string, goalId: string, opikOptions?: OpikHandlerOptions): Promise<ResourceSuggestionResult> {
    await this.initialize();
    assert(this.agent, `${this.agentName} not ready`);

    const handler = createOpikHandler({
      tags: [this.agentName, 'operation:suggest', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId,
        goalId,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const result = await this.agent.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId }))] },
      { callbacks: [handler], runName: this.agentName }
    );

    return {
      goal: result.structuredResponse.goal,
      resources: result.structuredResponse.resources
    };
  }
}

const skillResourceAgentInstance = new SkillResourceAgent();
export default skillResourceAgentInstance;
