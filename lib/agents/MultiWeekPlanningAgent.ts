import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserAvailabilityTool } from '@/lib/tools/fetchUserAvailabilityTool';
import { fetchAcceptedRoadmapTool } from '@/lib/tools/fetchAcceptedRoadmapTool';
import { saveMultiWeekPlanTool } from '@/lib/tools/saveMultiWeekPlanTool';
import { getAgentPrompt } from '@/lib/prompts';

interface LearningSession {
  day: string;
  startTime: string;
  endTime: string;
  roadmapStep: string;
  activities: string[];
  durationMinutes: number;
}

interface WeeklyPlan {
  weekNumber: number;
  weekStartDate: string;
  focusArea: string;
  sessions: LearningSession[];
  totalMinutes: number;
  completionPercentage: number;
}

interface MultiWeekPlan {
  totalWeeks: number;
  estimatedCompletionDate: string;
  weeks: WeeklyPlan[];
}

const MultiWeekPlanSchema = z.object({
  totalWeeks: z.number(),
  estimatedCompletionDate: z.string(),
  weeks: z.array(
    z.object({
      weekNumber: z.number(),
      weekStartDate: z.string(),
      focusArea: z.string(),
      sessions: z.array(
        z.object({
          day: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          roadmapStep: z.string(),
          activities: z.array(z.string()),
          durationMinutes: z.number()
        })
      ),
      totalMinutes: z.number(),
      completionPercentage: z.number()
    })
  )
});

class MultiWeekPlanningAgent {
  private agent: ReturnType<typeof createAgent> | null = null;
  private agentName: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.agentName = 'MultiWeekPlanningAgent';
  }

  private async initialize(): Promise<void> {
    if (this.agent) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const systemPrompt = await getAgentPrompt('multi-week-planning-agent');
        this.agent = createAgent({
          model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
          tools: [fetchUserTool, fetchUserAvailabilityTool, fetchAcceptedRoadmapTool, saveMultiWeekPlanTool],
          systemPrompt: new SystemMessage(systemPrompt),
          responseFormat: providerStrategy(MultiWeekPlanSchema)
        });
      })();
    }

    await this.initPromise;
  }

  public async createMultiWeekPlan(
    userId: string,
    goalId: string,
    startDate: string,
    opikOptions?: OpikHandlerOptions
  ): Promise<MultiWeekPlan> {
    await this.initialize();

    const handler = createOpikHandler({
      tags: ['agent:multi-week-planning', 'operation:create', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId,
        goalId,
        startDate,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const result = await this.agent!.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId, startDate }))] },
      { callbacks: [handler], runName: this.agentName }
    );

    return {
      totalWeeks: result.structuredResponse.totalWeeks,
      estimatedCompletionDate: result.structuredResponse.estimatedCompletionDate,
      weeks: result.structuredResponse.weeks
    };
  }
}

const multiWeekPlanningAgentInstance = new MultiWeekPlanningAgent();
export default multiWeekPlanningAgentInstance;
