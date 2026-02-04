import { NextRequest } from 'next/server';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceById } from '@/lib/db/resourceRepository';
import { getScheduleByUserAndGoal } from '@/lib/db/scheduleRepository';
import { getCurrentWeeklyPlan } from '@/lib/db/weeklyPlanRepository';
import { getUserById } from '@/lib/db/userRepository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
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

  const user = await getUserById(userId);
  const schedule = await getScheduleByUserAndGoal(userId, goalId);
  const currentWeekPlan = await getCurrentWeeklyPlan(goalId);

  return new Response(
    JSON.stringify({
      goal: {
        ...goal,
        selectedResource,
        userCareerGoals: user?.careerGoals ?? [],
        availability: schedule
          ? {
              weeklyHours: schedule.weeklyHours,
              startDate: schedule.startDate,
              targetCompletionDate: schedule.targetCompletionDate,
              slots: schedule.slots.map((slot) => ({
                day: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                durationMinutes: slot.durationMinutes
              }))
            }
          : null,
        currentWeekPlan
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
