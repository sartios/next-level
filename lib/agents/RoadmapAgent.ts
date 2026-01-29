import assert from 'node:assert';
import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { Goal, RoadmapStep } from '@/lib/mockDb';
import { GoalSchema, ResourceSchema, RoadmapStepSchema } from '@/lib/schemas';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { fetchUserAvailabilityTool } from '@/lib/tools/fetchUserAvailabilityTool';
import { saveGoalRoadmapTool } from '@/lib/tools/saveGoalRoadmapTool';
import { getAgentPrompt } from '@/lib/prompts';

interface RoadmapResult {
  goal: Goal;
  roadmap: RoadmapStep[];
}

const RoadmapResultSchema = z.object({
  goal: GoalSchema.extend({
    resources: z.array(ResourceSchema).describe('Learning resources for the goal')
  }).omit({ roadmap: true, plan: true }),
  roadmap: z.array(RoadmapStepSchema)
});

class RoadmapAgent {
  private readonly agentName = 'roadmap-agent';
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
            tools: [fetchUserTool, fetchUserGoalTool, fetchUserAvailabilityTool, saveGoalRoadmapTool],
            systemPrompt: new SystemMessage(systemPrompt),
            responseFormat: providerStrategy(RoadmapResultSchema)
          });
        } catch (error) {
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  public async createRoadmap(userId: string, goalId: string, opikOptions?: OpikHandlerOptions): Promise<RoadmapResult> {
    await this.initialize();
    assert(this.agent, `${this.agentName} not ready`);

    const handler = createOpikHandler({
      tags: [this.agentName, 'operation:create', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId,
        goalId,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const result = await this.agent!.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId }))] },
      { callbacks: [handler], runName: this.agentName }
    );

    return {
      goal: result.structuredResponse.goal,
      roadmap: result.structuredResponse.roadmap
    };
  }
}

const roadmapAgentInstance = new RoadmapAgent();
export default roadmapAgentInstance;
