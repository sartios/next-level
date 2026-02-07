import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getChallengeWithQuestions, getChallengeById, resetFailedChallenge } from '@/lib/db/challengeRepository';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';

interface RouteParams {
  params: Promise<{
    id: string;
    goalId: string;
    challengeId: string;
  }>;
}

// GET /api/users/[id]/goals/[goalId]/challenges/[challengeId] - Get a specific challenge with questions
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: userId, goalId, challengeId } = await params;

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

  if (challenge.status !== 'complete') {
    return new Response(
      JSON.stringify({
        errorMessage: 'Challenge is not ready yet',
        status: challenge.status,
        errorDetail: challenge.errorMessage
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const challengeWithQuestions = await getChallengeWithQuestions(challengeId);

  return new Response(JSON.stringify(challengeWithQuestions), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// PATCH /api/users/[id]/goals/[goalId]/challenges/[challengeId] - Regenerate a failed challenge
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id: userId, goalId, challengeId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ errorMessage: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (typeof body !== 'object' || body === null || !('action' in body) || (body as { action: unknown }).action !== 'regenerate') {
    return new Response(JSON.stringify({ errorMessage: 'Invalid or unknown action. Expected { action: "regenerate" }' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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

  const updated = await resetFailedChallenge(challengeId);
  if (!updated) {
    return new Response(JSON.stringify({ errorMessage: 'Challenge is not in failed state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Trigger generation job in background
  startGenerateChallengesJob(userId, goalId, 'regenerate-failed');

  return new Response(JSON.stringify(updated), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}
