import { streamSkillSuggestions } from '@/lib/agents/UserSkillAgent';
import { UserSkillDatasetItem } from '../types';
import { getAgentPrompt } from '@/lib/prompts';
import { SKILLS_PER_USER } from '@/lib/prompts/agentPrompts';

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

  for await (const event of streamSkillSuggestions(item.input.user, {
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

  // Resolve prompts with the same variables the agent uses
  const promptVariables = {
    skillsPerUser: SKILLS_PER_USER,
    userRole: item.input.user.role,
    userSkills: item.input.user.skills.join(', '),
    userCareerGoals: item.input.user.careerGoals.join(', ')
  };

  const [systemPrompt, userPrompt] = await Promise.all([
    getAgentPrompt('user-skill-agent:system-prompt', promptVariables),
    getAgentPrompt('user-skill-agent:user-prompt', promptVariables)
  ]);

  // Build context for grounding the evaluation
  const context = [
    `User role: ${item.input.user.role}`,
    `User current skills: ${item.input.user.skills.join(', ')}`,
    `User career goals: ${item.input.user.careerGoals.join(', ')}`,
    `Expected skill count: ${item.expected.skillCount}`,
    `Skills to exclude (user already has): ${item.expected.excludedSkills.join(', ')}`,
    `Output format: JSON Lines — one JSON object per line with exactly these fields: name (string), priority (1-10), reasoning (string)`
  ];

  // Format output as JSON Lines to match the agent's prompt instructions
  const jsonLines = skills.map((s) => JSON.stringify({ name: s.name, priority: s.priority, reasoning: s.reasoning })).join('\n');

  return {
    input: `${systemPrompt}\n\n${userPrompt}`,
    output: jsonLines,
    context
  };
}
