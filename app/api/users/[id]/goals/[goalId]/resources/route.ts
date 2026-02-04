import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { challengesExistForGoal } from '@/lib/db/challengeRepository';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';
import { selectResourceAndCreateChallenges } from '@/lib/db/goalResourceService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: userId, goalId } = await params;

  const body = await req.json();
  const { resourceId } = body;

  if (!resourceId) {
    return new Response(JSON.stringify({ errorMessage: 'resourceId is required' }), {
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

  // Get the resource with its sections
  const resource = await getLearningResourceWithSections(resourceId);
  const challengesExist = await challengesExistForGoal(goalId);

  // Prepare sections for challenge creation if needed
  const sections =
    resource && resource.sections.length > 0 && !challengesExist
      ? resource.sections.map((section) => ({
          id: section.id,
          title: section.title,
          topics: section.topics || []
        }))
      : null;

  // Update goal and create challenges atomically in a transaction
  const updatedGoal = await selectResourceAndCreateChallenges(goalId, resourceId, sections);

  // Start background job to generate challenges if we created them
  if (sections) {
    startGenerateChallengesJob(userId, goalId);
  }

  return new Response(JSON.stringify(updatedGoal), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
