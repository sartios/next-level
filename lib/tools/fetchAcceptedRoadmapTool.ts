import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const toolFunction = async ({ userId, goalId }: { userId: string; goalId: string }) =>
  repository.getAcceptedRoadmapByGoalAndUser(userId, goalId);

const toolDescription = {
  name: 'fetchAcceptedRoadmap',
  description: 'Fetch the accepted roadmap for a user and goal by userId and goalId',
  schema: z.object({ userId: z.string().describe('The user ID to accept roadmap for'), goalId: z.string() })
};

export const fetchAcceptedRoadmapTool = tool(toolFunction, toolDescription);
