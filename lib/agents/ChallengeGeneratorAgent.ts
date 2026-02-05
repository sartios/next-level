import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';
import { getAgentPrompt } from '@/lib/prompts';
import { QUESTIONS_PER_CHALLENGE, DIFFICULTY_DESCRIPTIONS } from '@/lib/prompts/agentPrompts';
import type { User } from '@/lib/db/userRepository';
import type { Goal } from '@/lib/db/goalRepository';
import type { LearningResourceWithSections } from '@/lib/db/resourceRepository';
import { updateChallengeStatus, addChallengeQuestions, type Challenge, type NewChallengeQuestion } from '@/lib/db/challengeRepository';

type Difficulty = 'easy' | 'medium' | 'hard';

interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

interface GeneratedQuestion {
  questionNumber: number;
  question: string;
  options: QuestionOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  hint?: string;
}

// ============================================================================
// Prompts
// ============================================================================

async function buildQuestionsSystemPrompt(difficulty: Difficulty, sectionTitle: string): Promise<string> {
  return getAgentPrompt('challenge-generator-agent:system-prompt', {
    questionsPerChallenge: QUESTIONS_PER_CHALLENGE,
    difficultyDescription: DIFFICULTY_DESCRIPTIONS[difficulty],
    sectionTitle,
    difficultyUpper: difficulty.toUpperCase()
  });
}

async function buildQuestionsUserPrompt(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  sectionTitle: string,
  sectionTopics: string[],
  difficulty: Difficulty
): Promise<string> {
  return getAgentPrompt('challenge-generator-agent:user-prompt', {
    questionsPerChallenge: QUESTIONS_PER_CHALLENGE,
    difficulty,
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
    sectionTitle,
    sectionTopics: sectionTopics.join(', ') || 'General topics'
  });
}

// ============================================================================
// Generator
// ============================================================================

function parseJsonResponse(content: string): GeneratedQuestion[] | null {
  try {
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    return JSON.parse(jsonContent.trim());
  } catch {
    return null;
  }
}

/**
 * Generate all questions for a single challenge (section)
 */
export async function generateChallengeQuestions(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  challenge: Challenge
): Promise<GeneratedQuestion[]> {
  const handler = createAgentOpikHandler('challenge-generator-agent', 'generate-section', {
    goalId: goal.id,
    challengeId: challenge.id,
    sectionId: challenge.sectionId,
    difficulty: challenge.difficulty
  });

  const llm = createStreamingLLM('gpt-5-mini');

  const systemPrompt = await buildQuestionsSystemPrompt(challenge.difficulty, challenge.sectionTitle);
  const userPrompt = await buildQuestionsUserPrompt(
    user,
    goal,
    resource,
    challenge.sectionTitle,
    challenge.sectionTopics || [],
    challenge.difficulty
  );

  let responseContent = '';
  const stream = await llm.stream([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
    callbacks: [handler]
  });

  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content === 'string') {
      responseContent += content;
    }
  }

  const parsed = parseJsonResponse(responseContent);
  if (!parsed || parsed.length !== QUESTIONS_PER_CHALLENGE) {
    throw new Error(`Failed to generate ${QUESTIONS_PER_CHALLENGE} questions`);
  }

  return parsed;
}

/**
 * Process a single challenge: generate questions and save to database
 */
export async function processChallengeGeneration(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  challenge: Challenge
): Promise<void> {
  // Mark as generating
  await updateChallengeStatus(challenge.id, 'generating');

  try {
    // Generate questions
    const questions = await generateChallengeQuestions(user, goal, resource, challenge);

    // Transform to database format
    const dbQuestions: NewChallengeQuestion[] = questions.map((q) => ({
      questionNumber: q.questionNumber,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      hint: q.hint
    }));

    // Save to database
    await addChallengeQuestions(challenge.id, dbQuestions);

    // Mark as complete
    await updateChallengeStatus(challenge.id, 'complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateChallengeStatus(challenge.id, 'failed', errorMessage);
    throw error;
  }
}

/**
 * Generate challenges for all sections of a resource
 * This is the main entry point called when a resource is selected for a goal
 */
export async function generateAllChallengesForGoal(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  challenges: Challenge[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const challenge of challenges) {
    try {
      await processChallengeGeneration(user, goal, resource, challenge);
      success++;
    } catch (error) {
      console.error(`Failed to generate challenge for section ${challenge.sectionTitle}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
