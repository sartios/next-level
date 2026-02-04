import { NextRequest, NextResponse } from 'next/server';
import { getScheduleByUserAndGoal, upsertSchedule, type NewScheduleSlot } from '@/lib/db/scheduleRepository';
import type { DayOfWeek } from '@/lib/db/schema';
import { syncWeeklyPlanWithSchedule } from '@/lib/services/weeklyPlanService';

interface AvailableSlotInput {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

function formatScheduleResponse(schedule: {
  userId: string;
  goalId: string;
  startDate: Date;
  weeklyHours: number;
  targetCompletionDate: Date | null;
  slots: { dayOfWeek: string; startTime: string; endTime: string; durationMinutes: number }[];
}) {
  return {
    userId: schedule.userId,
    goalId: schedule.goalId,
    startDate: schedule.startDate.toISOString().split('T')[0],
    totalHours: schedule.weeklyHours,
    targetCompletionDate: schedule.targetCompletionDate?.toISOString().split('T')[0] ?? null,
    availableSlots: schedule.slots.map((slot) => ({
      day: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes
    }))
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: userId, goalId } = await params;

  if (!userId || !goalId) {
    return NextResponse.json({ errorMessage: 'userId and goalId are required' }, { status: 400 });
  }

  const schedule = await getScheduleByUserAndGoal(userId, goalId);

  if (!schedule) {
    return NextResponse.json({ availability: null }, { status: 200 });
  }

  return NextResponse.json({ availability: formatScheduleResponse(schedule) }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, goalId, startDate, totalHours, availableSlots, targetCompletionDate } = body;

    if (!userId || !goalId) {
      return NextResponse.json({ errorMessage: 'userId and goalId are required' }, { status: 400 });
    }

    if (!startDate || totalHours === undefined) {
      return NextResponse.json({ errorMessage: 'startDate and totalHours are required' }, { status: 400 });
    }

    const slots: NewScheduleSlot[] = (availableSlots || []).map((slot: AvailableSlotInput) => ({
      dayOfWeek: slot.day as DayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes
    }));

    const schedule = await upsertSchedule(
      {
        userId,
        goalId,
        startDate: new Date(startDate),
        weeklyHours: totalHours,
        targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null
      },
      slots
    );

    const weeklyPlanResult = await syncWeeklyPlanWithSchedule({ goalId, schedule });

    return NextResponse.json(
      {
        availability: formatScheduleResponse(schedule),
        weeklyPlan: weeklyPlanResult
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error saving availability:', errorMessage);
    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
