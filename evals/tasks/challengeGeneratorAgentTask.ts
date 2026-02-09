import { generateChallengeQuestions } from '@/lib/agents/ChallengeGeneratorAgent';
import { getAgentPrompt, QUESTIONS_PER_CHALLENGE, DIFFICULTY_DESCRIPTIONS } from '@/lib/prompts';
import { ChallengeGeneratorDatasetItem } from '../types';
import type { Challenge } from '@/lib/db/challengeRepository';

/**
 * Evaluation task for the ChallengeGeneratorAgent.
 * Tests quiz question generation quality using Opik's built-in LLM-as-judge metrics.
 */
export async function challengeGeneratorAgentTask(item: ChallengeGeneratorDatasetItem): Promise<{
  input: string;
  output: string;
  context: string[];
}> {
  const { user, goal, resource, challenge: challengeData } = item.input;

  // Convert dates from strings to Date objects for Challenge type compatibility
  const challenge: Challenge = {
    ...challengeData,
    createdAt: new Date(challengeData.createdAt),
    updatedAt: new Date(challengeData.updatedAt)
  };

  const questions = await generateChallengeQuestions(user, goal, resource, challenge);

  // Resolve prompts with the same variables the agent uses
  const [systemPrompt, userPrompt] = await Promise.all([
    getAgentPrompt('challenge-generator-agent:system-prompt', {
      questionsPerChallenge: QUESTIONS_PER_CHALLENGE,
      difficultyDescription: DIFFICULTY_DESCRIPTIONS[challenge.difficulty],
      sectionTitle: challenge.sectionTitle,
      difficultyUpper: challenge.difficulty.toUpperCase()
    }),
    getAgentPrompt('challenge-generator-agent:user-prompt', {
      questionsPerChallenge: QUESTIONS_PER_CHALLENGE,
      difficulty: challenge.difficulty,
      userRole: user.role,
      userSkills: user.skills.join(', ') || 'Not specified',
      userCareerGoals: user.careerGoals.join(', ') || 'Not specified',
      goalName: goal.name,
      goalReasoning: goal.reasoning,
      resourceTitle: resource.title,
      resourceProvider: resource.provider,
      resourceType: resource.resourceType,
      resourceDescription: resource.description || 'No description',
      learningObjectives: resource.learningObjectives?.join(', ') || 'Not specified',
      sectionTitle: challenge.sectionTitle,
      sectionTopics: challenge.sectionTopics?.join(', ') || 'General topics'
    })
  ]);

  // Build context for grounding the evaluation
  // Include the actual output schema that the agent returns
  const context = [
    `User ID: ${user.id}`,
    `User role: ${user.role}`,
    `User skills: ${user.skills.join(', ')}`,
    `User career goals: ${user.careerGoals.join(', ')}`,
    `Goal ID: ${goal.id}`,
    `Learning goal: ${goal.name}`,
    `Goal reasoning: ${goal.reasoning}`,
    `Resource ID: ${resource.id}`,
    `Resource: ${resource.title}`,
    `Resource provider: ${resource.provider}`,
    `Challenge ID: ${challenge.id}`,
    `Section: ${challenge.sectionTitle}`,
    `Difficulty: ${challenge.difficulty}`,
    `Expected question count: ${QUESTIONS_PER_CHALLENGE}`,
    `Topics: ${challenge.sectionTopics?.join(', ') || 'General'}`,
    `Output format: Array of GeneratedQuestion objects with fields: questionNumber (1-${QUESTIONS_PER_CHALLENGE}), question (text), options (array of {label: A/B/C/D, text}), correctAnswer (A/B/C/D), explanation (text), hint (optional text)`
  ];

  return {
    input: `${systemPrompt}\n\n${userPrompt}`,
    output: JSON.stringify(questions),
    context
  };
}
