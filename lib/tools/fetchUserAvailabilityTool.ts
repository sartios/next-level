import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const toolFunction = async ({ userId }: { userId: string }) => repository.getWeeklyAvailability(userId);

const toolDescription = {
  name: 'fetchUserAvailability',
  description:
    'Fetch the user weekly availability schedule including available time slots for each day, start/end times, and total hours available per week. Use this to understand when the user can dedicate time to learning.',
  schema: z.object({ userId: z.string().describe('The user ID to fetch availability for') })
};

export const fetchUserAvailabilityTool = tool(toolFunction, toolDescription);
