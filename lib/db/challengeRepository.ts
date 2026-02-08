import { eq, and } from 'drizzle-orm';
import { requireDb } from './index';
import { challenges, challengeQuestions, type ChallengeDifficulty, type ChallengeStatus } from './schema';
import { optionsNormalizationSchema } from '@/lib/validation/schemas';

// ============================================================================
// Types
// ============================================================================

export interface Challenge {
  id: string;
  goalId: string;
  sectionId: string;
  sectionTitle: string;
  sectionTopics: string[] | null;
  difficulty: ChallengeDifficulty;
  status: ChallengeStatus;
  totalQuestions: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeQuestion {
  id: string;
  challengeId: string;
  questionNumber: number;
  question: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  hint: string | null;
  createdAt: Date;
}

export interface ChallengeWithQuestions extends Challenge {
  questions: ChallengeQuestion[];
}

export interface NewChallengeQuestion {
  questionNumber: number;
  question: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  hint?: string;
}

// ============================================================================
// Challenges
// ============================================================================

/**
 * Get all challenges for a goal
 */
export async function getChallengesByGoalId(goalId: string): Promise<Challenge[]> {
  const db = requireDb();
  return db.select().from(challenges).where(eq(challenges.goalId, goalId));
}

/**
 * Get a challenge by ID
 */
export async function getChallengeById(challengeId: string): Promise<Challenge | undefined> {
  const db = requireDb();
  const results = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  return results[0];
}

/**
 * Get a challenge with all questions
 */
export async function getChallengeWithQuestions(challengeId: string): Promise<ChallengeWithQuestions | undefined> {
  const db = requireDb();

  const challengeResults = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);

  if (challengeResults.length === 0) return undefined;

  const challenge = challengeResults[0];

  const questions = await db
    .select()
    .from(challengeQuestions)
    .where(eq(challengeQuestions.challengeId, challengeId))
    .orderBy(challengeQuestions.questionNumber);

  return {
    ...challenge,
    questions
  };
}

/**
 * Update challenge status
 */
export async function updateChallengeStatus(
  challengeId: string,
  status: ChallengeStatus,
  errorMessage?: string
): Promise<Challenge | undefined> {
  const db = requireDb();

  const [updated] = await db
    .update(challenges)
    .set({
      status,
      errorMessage: errorMessage || null,
      updatedAt: new Date()
    })
    .where(eq(challenges.id, challengeId))
    .returning();

  return updated;
}

/**
 * Atomically claim a challenge for generation.
 * Only updates if current status is 'pending', preventing race conditions.
 * Returns the challenge if successfully claimed, undefined if already claimed.
 */
export async function claimChallengeForGeneration(challengeId: string): Promise<Challenge | undefined> {
  const db = requireDb();

  const [claimed] = await db
    .update(challenges)
    .set({
      status: 'generating' as ChallengeStatus,
      updatedAt: new Date()
    })
    .where(and(eq(challenges.id, challengeId), eq(challenges.status, 'pending')))
    .returning();

  return claimed;
}

/**
 * Reset a failed challenge back to pending so it can be regenerated.
 * Performs a status-guarded update first, then deletes partial questions.
 * Wrapped in a transaction for atomicity.
 */
export async function resetFailedChallenge(challengeId: string): Promise<Challenge | undefined> {
  const db = requireDb();

  return db.transaction(async (tx) => {
    // Guard: only update if status is 'failed'
    const [updated] = await tx
      .update(challenges)
      .set({
        status: 'pending' as ChallengeStatus,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(and(eq(challenges.id, challengeId), eq(challenges.status, 'failed')))
      .returning();

    if (!updated) return undefined;

    // Safe to delete questions now that we've confirmed the challenge was failed
    await tx.delete(challengeQuestions).where(eq(challengeQuestions.challengeId, challengeId));

    return updated;
  });
}

// ============================================================================
// Challenge Questions
// ============================================================================

/**
 * Get a specific question by challenge ID and question number
 */
export async function getChallengeQuestion(challengeId: string, questionNumber: number): Promise<ChallengeQuestion | undefined> {
  const db = requireDb();

  const results = await db
    .select()
    .from(challengeQuestions)
    .where(and(eq(challengeQuestions.challengeId, challengeId), eq(challengeQuestions.questionNumber, questionNumber)))
    .limit(1);

  return results[0];
}

function normalizeOptions(options: unknown): { label: string; text: string }[] {
  return optionsNormalizationSchema.parse(options);
}

/**
 * Add questions to a challenge
 */
export async function addChallengeQuestions(challengeId: string, questions: NewChallengeQuestion[]): Promise<ChallengeQuestion[]> {
  const db = requireDb();

  const values = questions.map((q) => ({
    challengeId,
    questionNumber: q.questionNumber,
    question: q.question,
    options: normalizeOptions(q.options),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    hint: q.hint || null
  }));

  const inserted = await db.insert(challengeQuestions).values(values).returning();

  return inserted;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Difficulty levels for challenges
 */
const DIFFICULTY_LEVELS: ChallengeDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * Get initial status for a difficulty level
 * Easy starts as 'pending' (ready to generate), medium/hard start as 'locked'
 */
function getInitialStatus(difficulty: ChallengeDifficulty): ChallengeStatus {
  return difficulty === 'easy' ? 'pending' : 'locked';
}

/**
 * Create challenges for all sections of a resource
 * Creates 3 challenges per section (easy, medium, hard)
 * Easy starts as 'pending', medium and hard start as 'locked'
 */
export async function createChallengesForGoal(
  goalId: string,
  sections: Array<{ id: string; title: string; topics: string[] }>
): Promise<Challenge[]> {
  const db = requireDb();

  // Create 3 challenges per section (one for each difficulty level)
  // Easy is pending (ready to generate), medium/hard are locked
  const values = sections.flatMap((section) =>
    DIFFICULTY_LEVELS.map((difficulty) => ({
      goalId,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionTopics: section.topics,
      difficulty,
      status: getInitialStatus(difficulty),
      totalQuestions: 10
    }))
  );

  const inserted = await db.insert(challenges).values(values).returning();

  return inserted;
}

/**
 * Unlock the next difficulty level for a section
 * Called when a challenge is completed with sufficient score
 */
export async function unlockNextDifficulty(
  goalId: string,
  sectionId: string,
  currentDifficulty: ChallengeDifficulty
): Promise<Challenge | undefined> {
  const db = requireDb();

  // Determine next difficulty
  const nextDifficulty: ChallengeDifficulty | null =
    currentDifficulty === 'easy' ? 'medium' : currentDifficulty === 'medium' ? 'hard' : null;

  if (!nextDifficulty) return undefined;

  // Find and unlock the next challenge
  const [updated] = await db
    .update(challenges)
    .set({
      status: 'pending' as ChallengeStatus,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(challenges.goalId, goalId),
        eq(challenges.sectionId, sectionId),
        eq(challenges.difficulty, nextDifficulty),
        eq(challenges.status, 'locked')
      )
    )
    .returning();

  return updated;
}

/**
 * Check if challenges exist for a goal
 */
export async function challengesExistForGoal(goalId: string): Promise<boolean> {
  const db = requireDb();
  const results = await db.select().from(challenges).where(eq(challenges.goalId, goalId)).limit(1);
  return results.length > 0;
}

/**
 * Get challenge generation stats for a goal
 */
export async function getChallengeGenerationStats(goalId: string): Promise<{
  total: number;
  locked: number;
  pending: number;
  generating: number;
  complete: number;
  failed: number;
}> {
  const allChallenges = await getChallengesByGoalId(goalId);

  return {
    total: allChallenges.length,
    locked: allChallenges.filter((c) => c.status === 'locked').length,
    pending: allChallenges.filter((c) => c.status === 'pending').length,
    generating: allChallenges.filter((c) => c.status === 'generating').length,
    complete: allChallenges.filter((c) => c.status === 'complete').length,
    failed: allChallenges.filter((c) => c.status === 'failed').length
  };
}
