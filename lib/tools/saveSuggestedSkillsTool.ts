import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as repository from '@/lib/repository';

const skillSchema = z.object({
  name: z.string().describe('The name of the skill'),
  priority: z.number().describe('Priority ranking (1 is highest, 10 is lowest)'),
  reasoning: z.string().describe('Explanation of why this skill is important')
});

const toolFunction = async ({ userId, skills }: { userId: string; skills: z.infer<typeof skillSchema>[] }) => {
  repository.saveSuggestedSkills(userId, skills);
  return { success: true, message: `Successfully saved ${skills.length} suggested skills to the database` };
};

const toolDescription = {
  name: 'saveSuggestedSkills',
  description:
    'Save the generated skill suggestions to the database. You MUST call this tool after generating the complete list of suggested skills to persist them.',
  schema: z.object({
    userId: z.string().describe('The user ID to save suggested skills for'),
    skills: z.array(skillSchema).describe('Array of suggested skills to save')
  })
};

export const saveSuggestedSkillsTool = tool(toolFunction, toolDescription);
