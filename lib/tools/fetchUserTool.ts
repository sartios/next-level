import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const toolFunction = async ({ userId }: { userId: string }) => repository.getUserById(userId);

const toolDescription = {
  name: 'fetchUser',
  description: 'Fetch user information by userId',
  schema: z.object({ userId: z.string() })
};

export const fetchUserTool = tool(toolFunction, toolDescription);
