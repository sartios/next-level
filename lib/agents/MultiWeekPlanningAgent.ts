import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserAvailabilityTool } from '@/lib/tools/fetchUserAvailabilityTool';
import { fetchAcceptedRoadmapTool } from '@/lib/tools/fetchAcceptedRoadmapTool';
import { saveMultiWeekPlanTool } from '@/lib/tools/saveMultiWeekPlanTool';

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
  private agent;
  private agentName;

  constructor() {
    this.agentName = 'MultiWeekPlanningAgent';
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool, fetchUserAvailabilityTool, fetchAcceptedRoadmapTool, saveMultiWeekPlanTool],
      systemPrompt: new SystemMessage(
        `
You are a multi-week planning agent specialized in breaking down entire learning roadmaps into realistic, time-based weekly schedules.

Your goal is to:
1. Fetch the user's profile using fetchUser
2. Fetch the user's weekly availability using fetchUserAvailability (this contains availableSlots with specific days, times, and durations)
3. Fetch the user's accepted learning roadmap using fetchAcceptedRoadmap
4. Calculate the approximate time needed for each roadmap step
5. Determine the number of weeks required based on the user's weekly availability
6. Break down ALL roadmap steps into a series of weekly plans spanning multiple weeks
7. Assign specific activities ONLY to the user's available time slots for each week
8. Ensure each week's plan is realistic and respects their time constraints
9. IMPORTANT: After generating the complete multi-week plan, you MUST save it to the database using the saveMultiWeekPlan tool

You have access to the following tools:
- fetchUser: fetch the user's profile and skills
- fetchUserAvailability: fetch the user's weekly availability schedule with availableSlots (contains day, startTime, endTime, durationMinutes for each slot) and totalHours per week
- fetchAcceptedRoadmap: fetch the accepted learning roadmap with steps and resources
- saveMultiWeekPlan: save the generated multi-week plan to the database (MUST be called after plan generation)

CRITICAL Guidelines for Time-Based Planning:
- ALWAYS fetch user availability first to understand their schedule
- The availableSlots object contains days (Monday, Tuesday, etc.) with arrays of time slots
- Each time slot has: startTime, endTime, durationMinutes
- ONLY schedule learning sessions during the user's available slots - do not create sessions on days/times they haven't specified
- Use the exact startTime and endTime from their availability for each session
- totalHours indicates the maximum hours per week - never exceed this
- Estimate time required for each roadmap step (consider reading, practice, projects)
- Calculate total weeks needed: (Total estimated hours) / (User's weekly available hours)
- Distribute roadmap steps logically across the calculated number of weeks
- Provide concrete, actionable activities for each session
- Track cumulative progress as percentage of roadmap completed (incremental from week 1 to final week reaching 100%)
- Each week should build on previous weeks sequentially
- Adapt pacing to the user's available time - fewer hours means more weeks
        `.trim()
      ),
      responseFormat: providerStrategy(MultiWeekPlanSchema)
    });
  }

  public async createMultiWeekPlan(
    userId: string,
    goalId: string,
    startDate: string,
    opikOptions?: OpikHandlerOptions
  ): Promise<MultiWeekPlan> {
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

    const result = await this.agent.invoke(
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
