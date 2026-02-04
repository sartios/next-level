import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { getChallengesByGoalId, getChallengeGenerationStats } from '@/lib/db/challengeRepository';
import { getProgressForChallenges } from '@/lib/db/challengeProgressRepository';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';

interface RouteParams {
  params: Promise<{
    id: string;
    goalId: string;
  }>;
}

// GET /api/users/[id]/goals/[goalId]/challenges - List all challenges
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: userId, goalId } = await params;

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

  const challenges = await getChallengesByGoalId(goalId);
  const stats = await getChallengeGenerationStats(goalId);

  // Get progress for all challenges
  const challengeIds = challenges.map((c) => c.id);
  const progressMap = await getProgressForChallenges(challengeIds, userId);

  // Get resource info if available
  let resource = null;
  if (goal.selectedResourceId) {
    resource = await getLearningResourceWithSections(goal.selectedResourceId);
  }

  return new Response(
    JSON.stringify({
      challenges,
      stats,
      progress: progressMap,
      resource: resource
        ? {
            id: resource.id,
            title: resource.title,
            provider: resource.provider,
            resourceType: resource.resourceType
          }
        : null
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// POST /api/users/[id]/goals/[goalId]/challenges - Trigger challenge generation
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: userId, goalId } = await params;

  // Check if this is a generate request
  let generateRequest = false;
  try {
    const body = await req.json();
    generateRequest = body.generate === true;
  } catch {
    // No body or invalid JSON
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

  if (!goal.selectedResourceId) {
    return new Response(JSON.stringify({ errorMessage: 'No resource selected for this goal' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // If this is a generate request, trigger background generation
  if (generateRequest) {
    const challenges = await getChallengesByGoalId(goalId);
    const pendingChallenges = challenges.filter((c) => c.status === 'pending');

    if (pendingChallenges.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No pending challenges to generate',
          stats: await getChallengeGenerationStats(goalId)
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Start background job - returns immediately
    startGenerateChallengesJob(userId, goalId);

    return new Response(
      JSON.stringify({
        message: `Started generating ${pendingChallenges.length} challenges in the background`,
        stats: await getChallengeGenerationStats(goalId)
      }),
      {
        status: 202, // Accepted - processing started
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Otherwise just return current stats
  const stats = await getChallengeGenerationStats(goalId);

  return new Response(JSON.stringify({ stats }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
