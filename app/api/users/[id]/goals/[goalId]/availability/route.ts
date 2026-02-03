import { NextRequest, NextResponse } from 'next/server';
import { getScheduleByUserAndGoal, upsertSchedule, type NewScheduleSlot } from '@/lib/db/scheduleRepository';
import type { DayOfWeek } from '@/lib/db/schema';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import {
  generateSingleWeekPlan,
  generateSessionsForNewSlots,
  scheduleToAvailabilitySlots,
  getWeekStartDate,
  getCurrentWeekNumber
} from '@/lib/utils/createWeeklyPlan';
import {
  createWeeklyPlan,
  getWeeklyPlanByWeekNumber,
  getWeeklyPlansByGoalId,
  syncSessionsWithAvailability,
  addPlanSession,
  getCompletedSectionTitles,
  type AvailabilitySlot,
  type NewPlanSession
} from '@/lib/db/weeklyPlanRepository';

interface AvailableSlotInput {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: userId, goalId } = await params;

  if (!userId) {
    return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
  }

  if (!goalId) {
    return NextResponse.json({ errorMessage: 'goalId is required' }, { status: 400 });
  }

  const schedule = await getScheduleByUserAndGoal(userId, goalId);

  if (!schedule) {
    return NextResponse.json({ availability: null }, { status: 200 });
  }

  // Transform to the expected format
  const availability = {
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

  return NextResponse.json({ availability }, { status: 200 });
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

    // Transform slots to database format
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

    // Transform response to expected format
    const availability = {
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

    // Generate or sync weekly plan based on selected resource and availability
    let weeklyPlanResult = null;
    const goal = await getGoalById(goalId);

    if (goal?.selectedResourceId) {
      const resource = await getLearningResourceWithSections(goal.selectedResourceId);
      if (resource) {
        const scheduleStartDate = new Date(startDate);

        // Convert slots to AvailabilitySlot format for syncing (with duration)
        const newAvailabilitySlots: AvailabilitySlot[] = slots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMinutes: slot.durationMinutes
        }));

        // Calculate the current week number based on the schedule start date
        const currentWeekNumber = getCurrentWeekNumber(scheduleStartDate);

        // Get the plan for the current week only (not just the most recent)
        const currentWeekPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber);

        if (currentWeekPlan) {
          // Plan exists - sync sessions with new slots
          // This removes sessions for removed slots and identifies new slots
          const syncResult = await syncSessionsWithAvailability(currentWeekPlan.id, newAvailabilitySlots);

          // Create sessions for new slots
          let addedSessions: NewPlanSession[] = [];
          if (syncResult.newSlots.length > 0) {
            // Get completed sections and all existing sessions for calculation
            const completedSectionTitles = await getCompletedSectionTitles(goalId);
            const allPlans = await getWeeklyPlansByGoalId(goalId);

            // Flatten all sessions from all plans
            const allExistingSessions = allPlans.flatMap((plan) =>
              plan.sessions.map((s) => ({
                topic: s.topic,
                durationMinutes: s.durationMinutes
              }))
            );

            // Generate sessions for the new slots
            const result = generateSessionsForNewSlots({
              newSlots: syncResult.newSlots.map((slot) => ({
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                durationMinutes: slot.durationMinutes || 30
              })),
              resource,
              completedSectionTitles,
              allExistingSessions
            });

            // Add the generated sessions to the plan
            for (const session of result.sessions) {
              await addPlanSession(currentWeekPlan.id, session);
            }
            addedSessions = result.sessions;
          }

          // Refetch the updated plan for the current week
          const updatedPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber);

          weeklyPlanResult = {
            action: 'synced',
            weekNumber: currentWeekPlan.weekNumber,
            plan: updatedPlan,
            syncResult: {
              deletedSessionIds: syncResult.deletedSessionIds,
              remainingSessionCount: syncResult.remainingSessions.length,
              addedSessionCount: addedSessions.length
            }
          };
        } else {
          // No plan exists for current week - generate it
          const availabilitySlots = scheduleToAvailabilitySlots(schedule.slots);
          const weekStartDate = getWeekStartDate(scheduleStartDate, currentWeekNumber);

          // Get completed sections and incomplete sessions from previous weeks
          const completedSectionTitles = await getCompletedSectionTitles(goalId);

          // Get incomplete sessions from the previous week if it exists
          let incompleteSessionsFromPreviousWeek: { topic: string; activities: string[] }[] = [];
          if (currentWeekNumber > 1) {
            const previousWeekPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber - 1);
            if (previousWeekPlan) {
              incompleteSessionsFromPreviousWeek = previousWeekPlan.sessions
                .filter((s) => s.status !== 'completed')
                .map((s) => ({ topic: s.topic, activities: s.activities }));
            }
          }

          // Generate the plan for current week
          const generatedPlan = generateSingleWeekPlan({
            goalId,
            weekNumber: currentWeekNumber,
            weekStartDate,
            availabilitySlots,
            resource,
            completedSectionTitles,
            incompleteSessionsFromPreviousWeek
          });

          // Save the plan to the database
          const savedPlan = await createWeeklyPlan(generatedPlan.plan, generatedPlan.sessions);

          weeklyPlanResult = {
            action: 'created',
            weekNumber: currentWeekNumber,
            plan: savedPlan
          };
        }
      }
    }

    return NextResponse.json({ availability, weeklyPlan: weeklyPlanResult }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error saving availability:', errorMessage);
    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
