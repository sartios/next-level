import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';
import { ResourceSchema } from '@/lib/schemas';

const toolFunction = async ({ resources }: { resources: z.infer<typeof ResourceSchema>[] }) => {
  const updatedGoal = repository.updateGoalResources(resources);
  return { success: true, message: `Successfully saved ${resources.length} resources to the goal`, goal: updatedGoal };
};

const toolDescription = {
  name: 'updateGoalResources',
  description:
    'Save learning resources to the current goal. Call this after generating resources for a skill/goal to persist them in the database.',
  schema: z.object({
    resources: z.array(ResourceSchema).describe('Array of learning resources to save to the goal')
  })
};

export const updateGoalResourcesTool = tool(toolFunction, toolDescription);
