import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceById } from '@/lib/db/resourceRepository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
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

  let selectedResource = null;
  if (goal.selectedResourceId) {
    selectedResource = await getLearningResourceById(goal.selectedResourceId);
  }

  return new Response(
    JSON.stringify({
      goal: {
        ...goal,
        selectedResource
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
