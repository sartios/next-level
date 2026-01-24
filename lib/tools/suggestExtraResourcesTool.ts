import { tool } from 'langchain';
import { z } from 'zod';
import skillResourceAgentInstance from '@/lib/agents/SkillResourceAgent';

const SuggestExtraResourceToolInput = z.object({
  userId: z.string().describe('The ID of the user'),
  goalId: z.string().describe('The ID of the goal')
});

export const suggestExtraResourcesTool = tool(
  async ({ userId, goalId }: z.infer<typeof SuggestExtraResourceToolInput>) => {
    const result = await skillResourceAgentInstance.suggestResources(userId, goalId, {
      tags: ['resource-agent', 'invoked-as-subagent'],
      metadata: { userId, goalId }
    });

    return result;
  },
  {
    name: 'skill_resource_agent',
    description: 'Suggests additional learning resources for a user based on their goal.',
    schema: SuggestExtraResourceToolInput
  }
);
