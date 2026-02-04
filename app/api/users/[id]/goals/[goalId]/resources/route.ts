import { NextRequest } from 'next/server';
import { getGoalById, updateGoalSelectedResource } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { createChallengesForGoal, challengesExistForGoal } from '@/lib/db/challengeRepository';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';

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

  // Update the goal with selected resource
  const updatedGoal = await updateGoalSelectedResource(goalId, resourceId);

  // Get the resource with its sections and create challenge placeholders
  try {
    const resource = await getLearningResourceWithSections(resourceId);

    if (resource && resource.sections.length > 0) {
      const challengesExist = await challengesExistForGoal(goalId);

      if (!challengesExist) {
        const sections = resource.sections.map((section) => ({
          id: section.id,
          title: section.title,
          topics: section.topics || []
        }));

        await createChallengesForGoal(goalId, sections);

        // Start background job to generate challenges
        startGenerateChallengesJob(userId, goalId);
      }
    }
  } catch (error) {
    // Log but don't fail - challenges feature may not be set up yet
    console.warn('Could not create challenge placeholders:', error);
  }

  return new Response(JSON.stringify(updatedGoal), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
