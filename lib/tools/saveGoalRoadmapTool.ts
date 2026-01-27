import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';
import { RoadmapStepSchema } from '@/lib/schemas';

const toolFunction = async ({
  userId,
  goalId,
  roadmap
}: {
  userId: string;
  goalId: string;
  roadmap: z.infer<typeof RoadmapStepSchema>[];
}) => {
  const updatedGoal = repository.saveRoadmap(userId, goalId, roadmap);
  return { success: true, message: `Successfully saved ${roadmap.length} roadmap steps to the goal`, goal: updatedGoal };
};

const toolDescription = {
  name: 'saveGoalRoadmap',
  description:
    'Save the generated learning roadmap to the goal. Call this after creating the complete roadmap to persist it in the database. Each roadmap step must include: step name, description, resources, status (pending/started/completed), and timeline (array of scheduled dates with startTime, endTime, durationMinutes).',
  schema: z.object({
    userId: z.string().describe('The user ID to save goal roadmap for'),
    goalId: z.string().describe('Goal ID of the current goal'),
    roadmap: z.array(RoadmapStepSchema).describe('Array of roadmap steps to save, each with step, description, resources, status, and timeline')
  })
};

export const saveGoalRoadmapTool = tool(toolFunction, toolDescription);
