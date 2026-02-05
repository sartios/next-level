import userSkillAgent from '@/lib/agents/UserSkillAgent';
import { UserSkillDatasetItem } from '../types';
import { getAgentPrompt } from '@/lib/prompts';

/**
 * Evaluation task for the UserSkillAgent.
 * Tests skill suggestion quality using streaming and Opik's built-in LLM-as-judge metrics.
 */
export async function userSkillAgentTask(item: UserSkillDatasetItem): Promise<{
  input: string;
  output: string;
  context: string[];
}> {
  // Use streaming method with dataset user and collect the complete result
  let skills: { name: string; priority: number; reasoning: string }[] = [];

  for await (const event of userSkillAgent.streamSkillSuggestions(item.input.user, {
    tags: ['evaluation', 'user-skill-agent'],
    metadata: {
      evaluationId: item.id,
      evaluationName: item.name
    }
  })) {
    if (event.type === 'complete' && event.result) {
      skills = event.result.skills;
    }
  }

  // Get input prompt for LLM-as-judge metrics
  const systemPrompt = await getAgentPrompt('user-skill-agent:system-prompt');

  // Build context for grounding the evaluation
  // Include the actual output schema that the agent returns
  const context = [
    `User ID: ${item.input.user.id}`,
    `User role: ${item.input.user.role}`,
    `User current skills: ${item.input.user.skills.join(', ')}`,
    `User career goals: ${item.input.user.careerGoals.join(', ')}`,
    `Expected skill count: ${item.expected.skillCount}`,
    `Skills to exclude (user already has): ${item.expected.excludedSkills.join(', ')}`,
    `Output format: Array of SuggestedSkill objects with fields: id (generated UUID), userId (user's ID), name (skill name), priority (1-10), reasoning (explanation)`
  ];

  return {
    input: systemPrompt,
    output: JSON.stringify(skills),
    context
  };
}
