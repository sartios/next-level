import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getChallengeById } from '@/lib/db/challengeRepository';
import { getOrCreateProgress, recordAnswer, resetProgress } from '@/lib/db/challengeProgressRepository';

interface RouteParams {
  params: Promise<{
    id: string;
    goalId: string;
    challengeId: string;
  }>;
}

// GET /api/users/[id]/goals/[goalId]/challenges/[challengeId]/progress
// Get current progress for a challenge
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: visitorId, goalId, challengeId } = await params;

  const goal = await getGoalById(goalId);
  if (!goal) {
    return new Response(JSON.stringify({ errorMessage: 'Goal not found' }), {
      status: 404,
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

  const progress = await getOrCreateProgress(challengeId, visitorId);

  return new Response(JSON.stringify(progress), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// POST /api/users/[id]/goals/[goalId]/challenges/[challengeId]/progress
// Record an answer or update progress
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: visitorId, goalId, challengeId } = await params;

  let body: {
    action: 'answer' | 'reset';
    questionNumber?: number;
    answer?: string;
    isCorrect?: boolean;
    points?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ errorMessage: 'Invalid request body' }), {
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

  let progress;

  switch (body.action) {
    case 'answer':
      if (
        typeof body.questionNumber !== 'number' ||
        typeof body.answer !== 'string' ||
        typeof body.isCorrect !== 'boolean' ||
        typeof body.points !== 'number'
      ) {
        return new Response(JSON.stringify({ errorMessage: 'Missing required fields for answer action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      progress = await recordAnswer(challengeId, visitorId, {
        questionNumber: body.questionNumber,
        answer: body.answer,
        isCorrect: body.isCorrect,
        points: body.isCorrect ? body.points : 0
      });
      break;

    case 'reset':
      progress = await resetProgress(challengeId, visitorId);
      break;

    default:
      return new Response(JSON.stringify({ errorMessage: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }

  return new Response(JSON.stringify(progress), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
