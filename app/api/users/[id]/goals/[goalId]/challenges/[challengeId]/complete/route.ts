import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getChallengeById, unlockNextDifficulty } from '@/lib/db/challengeRepository';
import { markComplete, getOrCreateProgress } from '@/lib/db/challengeProgressRepository';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';

interface RouteParams {
  params: Promise<{
    id: string;
    goalId: string;
    challengeId: string;
  }>;
}

// POST /api/users/[id]/goals/[goalId]/challenges/[challengeId]/complete
// Body: { correctAnswers: number, totalQuestions: number }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: userId, goalId, challengeId } = await params;

  let body: { correctAnswers: number; totalQuestions: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ errorMessage: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { correctAnswers, totalQuestions } = body;

  if (typeof correctAnswers !== 'number' || typeof totalQuestions !== 'number') {
    return new Response(JSON.stringify({ errorMessage: 'correctAnswers and totalQuestions are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate goal
  const goal = await getGoalById(goalId);
  if (!goal) {
    return new Response(JSON.stringify({ errorMessage: 'Goal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (goal.userId !== userId) {
    return new Response(JSON.stringify({ errorMessage: 'Goal does not belong to user' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate challenge
  const challenge = await getChallengeById(challengeId);
  if (!challenge) {
    return new Response(JSON.stringify({ errorMessage: 'Challenge not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (challenge.goalId !== goalId) {
    return new Response(JSON.stringify({ errorMessage: 'Challenge does not belong to this goal' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if already completed
  const existingProgress = await getOrCreateProgress(challengeId, userId);
  if (existingProgress.status === 'completed') {
    return new Response(JSON.stringify({ errorMessage: 'Challenge already completed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Calculate score percentage
  const scorePercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const passed = scorePercentage >= 50;

  // Calculate points (10 points per correct answer)
  const earnedPoints = correctAnswers * 10;

  // Mark the challenge progress as complete
  await markComplete(challengeId, userId, correctAnswers, earnedPoints);

  let unlockedChallenge = null;

  // If passed (50% or more), unlock the next difficulty level
  if (passed) {
    unlockedChallenge = await unlockNextDifficulty(goalId, challenge.sectionId, challenge.difficulty);

    // If a challenge was unlocked, trigger generation in background
    if (unlockedChallenge) {
      startGenerateChallengesJob(userId, goalId);
    }
  }

  return new Response(
    JSON.stringify({
      challengeId,
      correctAnswers,
      totalQuestions,
      scorePercentage: Math.round(scorePercentage),
      passed,
      unlockedNextLevel: !!unlockedChallenge,
      unlockedDifficulty: unlockedChallenge?.difficulty || null
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
