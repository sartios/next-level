import { eq, and, inArray } from 'drizzle-orm';
import { requireDb } from './index';
import { challengeProgress, type ChallengeProgressStatus } from './schema';

// ============================================================================
// Types
// ============================================================================

export interface ChallengeProgress {
  id: string;
  challengeId: string;
  visitorId: string;
  currentQuestionIndex: number;
  answers: Record<number, { answer: string; isCorrect: boolean }>;
  correctAnswers: number;
  earnedPoints: number;
  status: ChallengeProgressStatus;
  startedAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
}

export interface AnswerRecord {
  questionNumber: number;
  answer: string;
  isCorrect: boolean;
  points: number;
}

// ============================================================================
// Progress Operations
// ============================================================================

/**
 * Get or create progress for a challenge
 */
export async function getOrCreateProgress(challengeId: string, visitorId: string): Promise<ChallengeProgress> {
  const db = requireDb();

  // Try to find existing progress
  const existing = await db
    .select()
    .from(challengeProgress)
    .where(and(eq(challengeProgress.challengeId, challengeId), eq(challengeProgress.visitorId, visitorId)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new progress
  const [created] = await db
    .insert(challengeProgress)
    .values({
      challengeId,
      visitorId,
      currentQuestionIndex: 0,
      answers: {},
      correctAnswers: 0,
      earnedPoints: 0,
      status: 'not_started'
    })
    .returning();

  return created;
}

/**
 * Record an answer and update progress
 */
export async function recordAnswer(challengeId: string, visitorId: string, record: AnswerRecord): Promise<ChallengeProgress> {
  const db = requireDb();

  // Get current progress
  const progress = await getOrCreateProgress(challengeId, visitorId);

  // Update answers
  const updatedAnswers = {
    ...progress.answers,
    [record.questionNumber]: {
      answer: record.answer,
      isCorrect: record.isCorrect
    }
  };

  // Calculate new totals
  const newCorrectAnswers = record.isCorrect ? progress.correctAnswers + 1 : progress.correctAnswers;
  const newEarnedPoints = progress.earnedPoints + record.points;

  // Update progress - set to in_progress if not already completed
  const [updated] = await db
    .update(challengeProgress)
    .set({
      answers: updatedAnswers,
      correctAnswers: newCorrectAnswers,
      earnedPoints: newEarnedPoints,
      status: progress.status === 'completed' ? 'completed' : 'in_progress',
      lastActivityAt: new Date()
    })
    .where(eq(challengeProgress.id, progress.id))
    .returning();

  return updated;
}

/**
 * Mark a challenge as complete
 */
export async function markComplete(
  challengeId: string,
  visitorId: string,
  correctAnswers: number,
  earnedPoints: number
): Promise<ChallengeProgress> {
  const db = requireDb();

  const progress = await getOrCreateProgress(challengeId, visitorId);

  const [updated] = await db
    .update(challengeProgress)
    .set({
      correctAnswers,
      earnedPoints,
      status: 'completed',
      completedAt: new Date(),
      lastActivityAt: new Date()
    })
    .where(eq(challengeProgress.id, progress.id))
    .returning();

  return updated;
}

/**
 * Reset progress for a challenge (for "Try Again")
 */
export async function resetProgress(challengeId: string, visitorId: string): Promise<ChallengeProgress> {
  const db = requireDb();

  const progress = await getOrCreateProgress(challengeId, visitorId);

  const [updated] = await db
    .update(challengeProgress)
    .set({
      currentQuestionIndex: 0,
      answers: {},
      correctAnswers: 0,
      earnedPoints: 0,
      status: 'not_started',
      completedAt: null,
      lastActivityAt: new Date()
    })
    .where(eq(challengeProgress.id, progress.id))
    .returning();

  return updated;
}

/**
 * Get progress summary for multiple challenges
 * Returns a map of challengeId -> { hasProgress, answeredCount, status }
 */
export async function getProgressForChallenges(
  challengeIds: string[],
  visitorId: string
): Promise<Record<string, { hasProgress: boolean; answeredCount: number; status: ChallengeProgressStatus }>> {
  if (challengeIds.length === 0) {
    return {};
  }

  const db = requireDb();

  const results = await db
    .select()
    .from(challengeProgress)
    .where(and(inArray(challengeProgress.challengeId, challengeIds), eq(challengeProgress.visitorId, visitorId)));

  const progressMap: Record<string, { hasProgress: boolean; answeredCount: number; status: ChallengeProgressStatus }> = {};

  for (const row of results) {
    const answeredCount = Object.keys(row.answers || {}).length;
    progressMap[row.challengeId] = {
      hasProgress: answeredCount > 0,
      answeredCount,
      status: row.status
    };
  }

  return progressMap;
}
