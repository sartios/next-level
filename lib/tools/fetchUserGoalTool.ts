import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const toolFunction = async ({ userId, goalId }: { userId: string; goalId: string }) => repository.getUserGoalById(userId, goalId);

const toolDescription = {
  name: 'fetchUserGoal',
  description: 'Fetch user goal by userId and goalId',
  schema: z.object({ userId: z.string().describe('The user ID to fetch goal for'), goalId: z.string() })
};

export const fetchUserGoalTool = tool(toolFunction, toolDescription);
