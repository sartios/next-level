import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const learningSessionSchema = z.object({
  day: z.string().describe('Day of the week'),
  startTime: z.string().describe('Start time of the session'),
  endTime: z.string().describe('End time of the session'),
  roadmapStep: z.string().describe('Which roadmap step this session covers'),
  activities: z.array(z.string()).describe('List of activities for this session'),
  durationMinutes: z.number().describe('Duration in minutes')
});

const weeklyPlanSchema = z.object({
  weekNumber: z.number().describe('Week number in the plan'),
  weekStartDate: z.string().describe('Start date of the week'),
  focusArea: z.string().describe('Main focus area for the week'),
  sessions: z.array(learningSessionSchema).describe('Learning sessions for the week'),
  totalMinutes: z.number().describe('Total learning minutes for the week'),
  completionPercentage: z.number().describe('Cumulative completion percentage')
});

const multiWeekPlanSchema = z.object({
  totalWeeks: z.number().describe('Total number of weeks in the plan'),
  estimatedCompletionDate: z.string().describe('Estimated completion date'),
  weeks: z.array(weeklyPlanSchema).describe('Weekly plans')
});

const toolFunction = async ({ userId, goalId, plan }: { userId: string; goalId: string; plan: z.infer<typeof multiWeekPlanSchema> }) => {
  const updatedGoal = repository.saveMultiWeekPlan(userId, goalId, plan);
  return { success: true, message: `Successfully saved ${plan.totalWeeks}-week learning plan to the goal`, goal: updatedGoal };
};

const toolDescription = {
  name: 'saveMultiWeekPlan',
  description:
    'Save the generated multi-week learning plan to the goal. Call this after generating a complete multi-week plan to persist it in the database.',
  schema: z.object({
    userId: z.string().describe('The user ID to generate multi-week learning plan for'),
    goalId: z.string(),
    plan: multiWeekPlanSchema
  })
};

export const saveMultiWeekPlanTool = tool(toolFunction, toolDescription);
