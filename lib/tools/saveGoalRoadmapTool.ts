import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const resourceSchema = z.object({
  title: z.string().describe('The title of the resource'),
  link: z.string().describe('URL link to the resource'),
  reasoning: z.string().describe('Explanation of why this resource is helpful')
});

const roadmapStepSchema = z.object({
  step: z.string().describe('The name/title of this learning step'),
  description: z.string().describe('Description of what to learn in this step'),
  resources: z.array(resourceSchema).describe('Resources to use for this step')
});

const toolFunction = async ({
  userId,
  goalId,
  roadmap
}: {
  userId: string;
  goalId: string;
  roadmap: z.infer<typeof roadmapStepSchema>[];
}) => {
  const updatedGoal = repository.saveRoadmap(userId, goalId, roadmap);
  return { success: true, message: `Successfully saved ${roadmap.length} roadmap steps to the goal`, goal: updatedGoal };
};

const toolDescription = {
  name: 'saveGoalRoadmap',
  description:
    'Save the generated learning roadmap to the goal. Call this after creating the complete roadmap to persist it in the database.',
  schema: z.object({
    userId: z.string().describe('The user ID to save goal roadmap for'),
    goalId: z.string().describe('Goal ID of the current goal'),
    roadmap: z.array(roadmapStepSchema).describe('Array of roadmap steps to save')
  })
};

export const saveGoalRoadmapTool = tool(toolFunction, toolDescription);
