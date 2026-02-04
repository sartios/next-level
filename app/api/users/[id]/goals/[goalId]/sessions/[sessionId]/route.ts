import { NextRequest } from 'next/server';
import { updateSessionStatus, getPlanSessionById, getWeeklyPlanById } from '@/lib/db/weeklyPlanRepository';
import { getGoalById } from '@/lib/db/goalRepository';
import { type PlanSessionStatus } from '@/lib/db/schema';

const validStatuses: PlanSessionStatus[] = ['pending', 'in_progress', 'completed', 'missed'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string; sessionId: string }> }) {
  const { id: userId, goalId, sessionId } = await params;

  // Verify the goal exists and belongs to the user
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

  try {
    const body = await req.json();
    const { status } = body as { status: PlanSessionStatus };

    if (!status || !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({
          errorMessage: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const existingSession = await getPlanSessionById(sessionId);
    if (!existingSession) {
      return new Response(JSON.stringify({ errorMessage: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const weeklyPlan = await getWeeklyPlanById(existingSession.weeklyPlanId);
    if (!weeklyPlan || weeklyPlan.goalId !== goalId) {
      return new Response(JSON.stringify({ errorMessage: 'Session does not belong to this goal' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updatedSession = await updateSessionStatus(sessionId, status);

    return new Response(JSON.stringify({ session: updatedSession }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating session status:', error);
    return new Response(JSON.stringify({ errorMessage: 'Failed to update session status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
