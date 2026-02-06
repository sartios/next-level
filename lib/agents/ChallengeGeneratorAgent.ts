import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentTrace, getOpikClient, LLMUsageCapture, type Trace, type Span } from '@/lib/opik';
import { getAgentPrompt, QUESTIONS_PER_CHALLENGE, DIFFICULTY_DESCRIPTIONS } from '@/lib/prompts';
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
  challenge: Challenge,
  parentSpan?: Trace | Span | null
): Promise<GeneratedQuestion[]> {
  const ownTrace = !parentSpan
    ? createAgentTrace('challenge-generator-agent', 'generate-section', {
        input: { goalId: goal.id, challengeId: challenge.id, sectionTitle: challenge.sectionTitle, difficulty: challenge.difficulty },
        metadata: { goalId: goal.id, challengeId: challenge.id, sectionId: challenge.sectionId, difficulty: challenge.difficulty }
      })
    : null;

  const spanParent = parentSpan || ownTrace;

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

  const llmSpan = spanParent?.span({
    name: `generate-questions:${challenge.sectionTitle}`,
    type: 'llm',
    input: { sectionTitle: challenge.sectionTitle, difficulty: challenge.difficulty, userPrompt }
  });

  let responseContent = '';
  const usageCapture = new LLMUsageCapture();

  try {
    const stream = await llm.stream([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
      callbacks: [usageCapture]
    });

    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string') {
        responseContent += content;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    llmSpan?.update({
      errorInfo: {
        exceptionType: error instanceof Error ? error.constructor.name : 'Error',
        message: errorMessage,
        traceback: error instanceof Error ? error.stack || '' : ''
      },
      endTime: new Date()
    });
    ownTrace?.update({
      errorInfo: {
        exceptionType: error instanceof Error ? error.constructor.name : 'Error',
        message: errorMessage,
        traceback: error instanceof Error ? error.stack || '' : ''
      },
      endTime: new Date()
    });
    if (ownTrace) await getOpikClient()?.flush();
    throw error;
  }

  const parsed = parseJsonResponse(responseContent);

  llmSpan?.update({
    input: { prompts: usageCapture.prompts },
    output: { questionCount: parsed?.length ?? 0, generations: usageCapture.generations },
    metadata: { invocationParams: usageCapture.invocationParams },
    model: usageCapture.model,
    provider: usageCapture.provider,
    usage: usageCapture.usage,
    endTime: new Date()
  });

  if (!parsed || parsed.length !== QUESTIONS_PER_CHALLENGE) {
    ownTrace?.update({
      errorInfo: { exceptionType: 'Error', message: `Failed to generate ${QUESTIONS_PER_CHALLENGE} questions`, traceback: '' },
      endTime: new Date()
    });
    if (ownTrace) await getOpikClient()?.flush();
    throw new Error(`Failed to generate ${QUESTIONS_PER_CHALLENGE} questions`);
  }

  ownTrace?.update({ output: { questionCount: parsed.length }, endTime: new Date() });
  if (ownTrace) await getOpikClient()?.flush();

  return parsed;
}

/**
 * Process a single challenge: generate questions and save to database
 */
export async function processChallengeGeneration(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  challenge: Challenge,
  parentTrace?: Trace | null
): Promise<void> {
  const processSpan = parentTrace?.span({
    name: `process-challenge:${challenge.sectionTitle}:${challenge.difficulty}`,
    type: 'general',
    input: { challengeId: challenge.id, sectionTitle: challenge.sectionTitle, difficulty: challenge.difficulty }
  });

  // Mark as generating
  await updateChallengeStatus(challenge.id, 'generating');

  try {
    // Generate questions
    const questions = await generateChallengeQuestions(user, goal, resource, challenge, processSpan);

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
    processSpan?.update({ output: { status: 'complete', questionCount: questions.length }, endTime: new Date() });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateChallengeStatus(challenge.id, 'failed', errorMessage);
    processSpan?.update({
      errorInfo: {
        exceptionType: error instanceof Error ? error.constructor.name : 'Error',
        message: errorMessage,
        traceback: error instanceof Error ? error.stack || '' : ''
      },
      endTime: new Date()
    });
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
  const trace = createAgentTrace('challenge-generator-agent', 'generate-all', {
    input: { goalId: goal.id, resourceTitle: resource.title, challengeCount: challenges.length },
    metadata: { goalId: goal.id, userId: user.id, resourceId: resource.id }
  });

  let success = 0;
  let failed = 0;

  try {
    for (const challenge of challenges) {
      try {
        await processChallengeGeneration(user, goal, resource, challenge, trace);
        success++;
      } catch (error) {
        console.error(`Failed to generate challenge for section ${challenge.sectionTitle}:`, error);
        failed++;
      }
    }

    trace?.update({ output: { success, failed, total: challenges.length }, endTime: new Date() });
  } catch (err) {
    trace?.update({
      errorInfo: {
        exceptionType: err instanceof Error ? err.constructor.name : 'Error',
        message: err instanceof Error ? err.message : String(err),
        traceback: err instanceof Error ? err.stack || '' : ''
      },
      endTime: new Date()
    });
    throw err;
  } finally {
    await getOpikClient()?.flush();
  }

  return { success, failed };
}
