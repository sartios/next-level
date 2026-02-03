import { NextRequest } from 'next/server';
import { getGoalById, updateGoalSelectedResource } from '@/lib/db/goalRepository';

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

  const updatedGoal = await updateGoalSelectedResource(goalId, resourceId);

  return new Response(JSON.stringify(updatedGoal), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
