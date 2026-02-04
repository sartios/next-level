import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import type { ScheduleWithSlots } from '@/lib/db/scheduleRepository';
import {
  createWeeklyPlan,
  getWeeklyPlanByWeekNumber,
  getWeeklyPlansByGoalId,
  syncSessionsWithAvailability,
  addPlanSession,
  getCompletedSectionTitles,
  type AvailabilitySlot,
  type WeeklyPlanWithSessions
} from '@/lib/db/weeklyPlanRepository';
import {
  generateSingleWeekPlan,
  generateSessionsForNewSlots,
  scheduleToAvailabilitySlots,
  getWeekStartDate,
  getCurrentWeekNumber
} from '@/lib/utils/createWeeklyPlan';

export interface SyncWeeklyPlanInput {
  goalId: string;
  schedule: ScheduleWithSlots;
}

export interface SyncWeeklyPlanResult {
  action: 'created' | 'synced' | 'skipped';
  weekNumber: number;
  plan: WeeklyPlanWithSessions | null;
  syncResult?: {
    deletedSessionIds: string[];
    remainingSessionCount: number;
    addedSessionCount: number;
  };
}

/**
 * Syncs or creates a weekly plan based on the current schedule.
 * - If no plan exists for the current week, creates one
 * - If a plan exists, syncs sessions with the new availability slots
 * - Only affects the current week (based on schedule start date)
 * - Retains completed sessions even if their slots are removed
 */
export async function syncWeeklyPlanWithSchedule(input: SyncWeeklyPlanInput): Promise<SyncWeeklyPlanResult | null> {
  const { goalId, schedule } = input;

  const goal = await getGoalById(goalId);
  if (!goal?.selectedResourceId) {
    return null;
  }

  const resource = await getLearningResourceWithSections(goal.selectedResourceId);
  if (!resource) {
    return null;
  }

  const scheduleStartDate = schedule.startDate;
  const currentWeekNumber = getCurrentWeekNumber(scheduleStartDate);

  // Convert schedule slots to availability slot format
  const newAvailabilitySlots: AvailabilitySlot[] = schedule.slots.map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes
  }));

  // Get the plan for the current week only
  const currentWeekPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber);

  if (currentWeekPlan) {
    // Plan exists - sync sessions with new slots
    const syncResult = await syncSessionsWithAvailability(currentWeekPlan.id, newAvailabilitySlots);

    // Create sessions for new slots
    let addedSessionCount = 0;
    if (syncResult.newSlots.length > 0) {
      const completedSectionTitles = await getCompletedSectionTitles(goalId);
      const allPlans = await getWeeklyPlansByGoalId(goalId);

      const allExistingSessions = allPlans.flatMap((plan) =>
        plan.sessions.map((s) => ({
          topic: s.topic,
          durationMinutes: s.durationMinutes
        }))
      );

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

      for (const session of result.sessions) {
        await addPlanSession(currentWeekPlan.id, session);
      }
      addedSessionCount = result.sessions.length;
    }

    // Refetch the updated plan
    const updatedPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber);

    return {
      action: 'synced',
      weekNumber: currentWeekNumber,
      plan: updatedPlan || null,
      syncResult: {
        deletedSessionIds: syncResult.deletedSessionIds,
        remainingSessionCount: syncResult.remainingSessions.length,
        addedSessionCount
      }
    };
  } else {
    // No plan exists for current week - generate it
    const availabilitySlots = scheduleToAvailabilitySlots(schedule.slots);
    const weekStartDate = getWeekStartDate(scheduleStartDate, currentWeekNumber);

    const completedSectionTitles = await getCompletedSectionTitles(goalId);

    // Get incomplete sessions from the previous week
    let incompleteSessionsFromPreviousWeek: { topic: string; activities: string[] }[] = [];
    if (currentWeekNumber > 1) {
      const previousWeekPlan = await getWeeklyPlanByWeekNumber(goalId, currentWeekNumber - 1);
      if (previousWeekPlan) {
        incompleteSessionsFromPreviousWeek = previousWeekPlan.sessions
          .filter((s) => s.status !== 'completed')
          .map((s) => ({ topic: s.topic, activities: s.activities }));
      }
    }

    const generatedPlan = generateSingleWeekPlan({
      goalId,
      weekNumber: currentWeekNumber,
      weekStartDate,
      availabilitySlots,
      resource,
      completedSectionTitles,
      incompleteSessionsFromPreviousWeek
    });

    const savedPlan = await createWeeklyPlan(generatedPlan.plan, generatedPlan.sessions);

    return {
      action: 'created',
      weekNumber: currentWeekNumber,
      plan: savedPlan
    };
  }
}
