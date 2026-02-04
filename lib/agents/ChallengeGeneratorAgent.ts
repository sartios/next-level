import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';
import type { User } from '@/lib/db/userRepository';
import type { Goal } from '@/lib/db/goalRepository';
import type { LearningResourceWithSections } from '@/lib/db/resourceRepository';
import { updateChallengeStatus, addChallengeQuestions, type Challenge, type NewChallengeQuestion } from '@/lib/db/challengeRepository';

const QUESTIONS_PER_CHALLENGE = 10;

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

function buildQuestionsSystemPrompt(difficulty: Difficulty, sectionTitle: string): string {
  const difficultyDescriptions = {
    easy: 'beginner-friendly questions that test basic recall and understanding',
    medium: 'intermediate questions that require applying knowledge to scenarios',
    hard: 'advanced questions that require deep understanding and critical thinking'
  };

  return `You are a quiz question generator for an educational platform.
Your task is to create ${QUESTIONS_PER_CHALLENGE} ${difficultyDescriptions[difficulty]} for the topic: "${sectionTitle}".

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

PROGRESSIVE COMPLEXITY:
- Questions should progressively increase in complexity from 1 to ${QUESTIONS_PER_CHALLENGE}
- Question 1: Most straightforward at this level
- Questions 2-4: Slightly more detailed, add small twists
- Questions 5-7: Middle complexity, require connecting ideas
- Questions 8-10: Near upper bound of this difficulty level

OUTPUT FORMAT:
You must output a valid JSON array with exactly ${QUESTIONS_PER_CHALLENGE} questions.
Each question must have:
- questionNumber (1-${QUESTIONS_PER_CHALLENGE})
- question (the question text)
- options (array of 4 options with label A/B/C/D and text)
- correctAnswer (A, B, C, or D)
- explanation (why the correct answer is right)
- hint (optional - a helpful hint without giving away the answer)

EXAMPLE FORMAT:
[
  {
    "questionNumber": 1,
    "question": "What is...?",
    "options": [
      {"label": "A", "text": "First option"},
      {"label": "B", "text": "Second option"},
      {"label": "C", "text": "Third option"},
      {"label": "D", "text": "Fourth option"}
    ],
    "correctAnswer": "B",
    "explanation": "The correct answer is B because...",
    "hint": "Think about..."
  }
]

CRITICAL:
- Output ONLY the JSON array, no markdown, no extra text
- Ensure exactly ONE option is correct per question
- Make incorrect options plausible but clearly wrong upon careful thought
- Questions must be diverse and cover different aspects of the topic`;
}

function buildQuestionsUserPrompt(
  user: User,
  goal: Goal,
  resource: LearningResourceWithSections,
  sectionTitle: string,
  sectionTopics: string[],
  difficulty: Difficulty
): string {
  return `Generate ${QUESTIONS_PER_CHALLENGE} ${difficulty} level questions for this learning context:

USER PROFILE:
- Role: ${user.role}
- Skills: ${user.skills.join(', ') || 'Not specified'}
- Career Goals: ${user.careerGoals.join(', ') || 'Not specified'}

LEARNING GOAL: ${goal.name}
- Reasoning: ${goal.reasoning}

LEARNING RESOURCE: ${resource.title}
- Provider: ${resource.provider}
- Type: ${resource.resourceType}
- Description: ${resource.description || 'No description'}
- Learning Objectives: ${resource.learningObjectives?.join(', ') || 'Not specified'}

CURRENT SECTION: ${sectionTitle}
- Topics covered: ${sectionTopics.join(', ') || 'General topics'}

Generate ${QUESTIONS_PER_CHALLENGE} questions that:
1. Are specifically about "${sectionTitle}" and its topics
2. Are appropriate for someone with the user's background
3. Help the user progress toward their goal
4. Match the ${difficulty} difficulty level

Output ONLY the JSON array.`;
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

  const systemPrompt = buildQuestionsSystemPrompt(challenge.difficulty, challenge.sectionTitle);
  const userPrompt = buildQuestionsUserPrompt(
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
