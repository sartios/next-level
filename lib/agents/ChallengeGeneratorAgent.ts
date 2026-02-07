import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentTrace, getOpikClient, type Trace, type Span } from '@/lib/opik';
import { getAgentPrompt, QUESTIONS_PER_CHALLENGE, DIFFICULTY_DESCRIPTIONS } from '@/lib/prompts';
import type { User } from '@/lib/db/userRepository';
import type { Goal } from '@/lib/db/goalRepository';
import type { LearningResourceWithSections } from '@/lib/db/resourceRepository';
import { updateChallengeStatus, addChallengeQuestions, type Challenge, type NewChallengeQuestion } from '@/lib/db/challengeRepository';
import { NextLevelOpikCallbackHandler } from '../trace/handler';
import { OpikSpanType } from 'opik';

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

  const generateQuestionsSpan = spanParent?.span({
    name: `generate-questions`,
    type: OpikSpanType.General,
    input: { sectionTitle: challenge.sectionTitle, difficulty: challenge.difficulty }
  });

  let responseContent = '';
  const traceHandler = new NextLevelOpikCallbackHandler({ parent: generateQuestionsSpan });

  try {
    const stream = await llm.stream([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
      callbacks: [traceHandler]
    });

    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string') {
        responseContent += content;
      }
    }
  } catch (error) {
    const errorInfo = parseErrorInfo(error);
    generateQuestionsSpan?.update({ errorInfo, endTime: new Date() });
    ownTrace?.update({ errorInfo, endTime: new Date() });
    if (ownTrace) await getOpikClient()?.flush();
    throw error;
  }

  const parsed = parseJsonResponse(responseContent);

  if (!parsed || parsed.length !== QUESTIONS_PER_CHALLENGE) {
    const actualCount = parsed?.length ?? 0;
    const reason = `Expected ${QUESTIONS_PER_CHALLENGE} questions but got ${actualCount}`;
    generateQuestionsSpan?.score({ name: 'needs_review', value: 0, reason, categoryName: 'question_count_mismatch' });
    generateQuestionsSpan?.update({ endTime: new Date() });
    ownTrace?.update({
      tags: ['review', 'question-count-mismatch'],
      errorInfo: { exceptionType: 'Error', message: reason, traceback: '' },
      endTime: new Date()
    });
    if (ownTrace) await getOpikClient()?.flush();
    throw new Error(reason);
  }

  const output = {
    questionCount: parsed.length,
    questions: parsed.map((q) => ({ questionNumber: q.questionNumber, question: q.question.slice(0, 120) }))
  };
  generateQuestionsSpan?.update({ output, endTime: new Date() });
  ownTrace?.update({ output, endTime: new Date() });
  if (ownTrace) await getOpikClient()?.flush();

  return parsed;
}

/**
 * Process a single challenge: generate questions and save to database
 */
async function processChallengeGeneration(
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
    processSpan?.update({ errorInfo: parseErrorInfo(error), endTime: new Date() });

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
  challenges: Challenge[],
  operation: string = 'generate-all'
): Promise<{ success: number; failed: number }> {
  const trace = createAgentTrace('challenge-generator-agent', operation, {
    input: {
      role: user.role,
      skills: user.skills,
      careerGoals: user.careerGoals,
      goalName: goal.name,
      reasoning: goal.reasoning,
      resourceTitle: resource.title
    },
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

    return { success, failed };
  } catch (err) {
    trace?.update({ errorInfo: parseErrorInfo(err), endTime: new Date() });
    throw err;
  } finally {
    await getOpikClient()?.flush();
  }
}

const parseErrorInfo = (err: unknown) => ({
  exceptionType: err instanceof Error ? err.constructor.name : 'Error',
  message: err instanceof Error ? err.message : String(err),
  traceback: err instanceof Error ? err.stack || '' : ''
});
