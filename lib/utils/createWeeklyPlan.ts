import type { LearningResourceWithSections } from '@/lib/types';
import type { ScheduleSlot } from '@/lib/db/scheduleRepository';
import type { DayOfWeek } from '@/lib/db/schema';
import type { NewWeeklyPlan, NewPlanSession, PlanSession } from '@/lib/db/weeklyPlanRepository';

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface GeneratedWeeklyPlan {
  plan: NewWeeklyPlan;
  sessions: NewPlanSession[];
}

export interface MultiWeekPlanResult {
  totalWeeks: number;
  estimatedCompletionDate: string;
  weeks: GeneratedWeeklyPlan[];
}

export interface GenerateSingleWeekInput {
  goalId: string;
  weekNumber: number;
  weekStartDate: Date;
  availabilitySlots: AvailabilitySlot[];
  resource: LearningResourceWithSections;
  /** Sections already completed (by title) */
  completedSectionTitles: string[];
  /** Incomplete sessions from previous week to carry over */
  incompleteSessionsFromPreviousWeek: PlanSession[];
}

/**
 * Creates multi-week learning plans based on availability slots and resource sections.
 * Distributes resource sections across available time slots.
 * Returns data ready to be inserted into the database.
 */
export function createWeeklyPlans(
  goalId: string,
  resource: LearningResourceWithSections,
  availabilitySlots: AvailabilitySlot[],
  weeklyHours: number,
  startDate: string
): MultiWeekPlanResult {
  // Sort sections by orderIndex to ensure correct progression through the course
  const sections = [...(resource.sections || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  // Calculate total resource duration
  const totalResourceMinutes = sections.reduce((sum, section) => sum + (section.estimatedMinutes || 30), 0);

  // Calculate weekly capacity in minutes
  const weeklyMinutes = weeklyHours * 60;

  // Calculate number of weeks needed
  const totalWeeks = Math.ceil(totalResourceMinutes / weeklyMinutes) || 1;

  // Calculate estimated completion date
  const start = new Date(startDate);
  const completionDate = new Date(start);
  completionDate.setDate(completionDate.getDate() + totalWeeks * 7);
  const estimatedCompletionDate = completionDate.toISOString().split('T')[0];

  // Sort availability slots by day order
  const dayOrder: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };

  const sortedSlots = [...availabilitySlots].sort((a, b) => {
    const dayDiff = (dayOrder[a.day] ?? 0) - (dayOrder[b.day] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  // Build weekly plans
  const weeks: GeneratedWeeklyPlan[] = [];
  let sectionIndex = 0;
  let sectionRemainingMinutes = sections[0]?.estimatedMinutes || 30;
  let cumulativeMinutes = 0;

  for (let weekNum = 1; weekNum <= totalWeeks; weekNum++) {
    const weekStartDate = new Date(start);
    weekStartDate.setDate(weekStartDate.getDate() + (weekNum - 1) * 7);

    const sessions: NewPlanSession[] = [];
    let weekMinutes = 0;
    const weekSections: string[] = [];

    // Fill slots with sections
    for (const slot of sortedSlots) {
      if (sectionIndex >= sections.length) break;

      const currentSection = sections[sectionIndex];
      const slotMinutes = slot.durationMinutes;

      // Determine how much of this slot to use
      const minutesToUse = Math.min(slotMinutes, sectionRemainingMinutes);

      sessions.push({
        dayOfWeek: slot.day as DayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: slotMinutes,
        topic: currentSection.title,
        activities: currentSection.topics?.length ? currentSection.topics.slice(0, 3) : [`Study ${currentSection.title}`]
      });

      weekMinutes += slotMinutes;
      cumulativeMinutes += minutesToUse;

      if (!weekSections.includes(currentSection.title)) {
        weekSections.push(currentSection.title);
      }

      sectionRemainingMinutes -= minutesToUse;

      // Move to next section if current one is complete
      if (sectionRemainingMinutes <= 0) {
        sectionIndex++;
        if (sectionIndex < sections.length) {
          sectionRemainingMinutes = sections[sectionIndex].estimatedMinutes || 30;
        }
      }
    }

    const completionPercentage = Math.min(100, Math.round((cumulativeMinutes / totalResourceMinutes) * 100));

    weeks.push({
      plan: {
        goalId,
        weekNumber: weekNum,
        weekStartDate,
        focusArea: weekSections.join(', ') || 'Getting Started',
        totalMinutes: weekMinutes,
        completionPercentage
      },
      sessions
    });
  }

  return {
    totalWeeks,
    estimatedCompletionDate,
    weeks
  };
}

/**
 * Converts database schedule slots to availability slots format
 */
export function scheduleToAvailabilitySlots(slots: ScheduleSlot[]): AvailabilitySlot[] {
  return slots.map((slot) => ({
    day: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes
  }));
}

/**
 * Sort availability slots by day of week and start time
 */
function sortAvailabilitySlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const dayOrder: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };

  return [...slots].sort((a, b) => {
    const dayDiff = (dayOrder[a.day] ?? 0) - (dayOrder[b.day] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Generates a single week's plan.
 * - First assigns slots to incomplete sessions from previous week
 * - Then assigns remaining slots to new sections from the resource
 * - Respects the user's available slot capacity
 */
export function generateSingleWeekPlan(input: GenerateSingleWeekInput): GeneratedWeeklyPlan {
  const { goalId, weekNumber, weekStartDate, availabilitySlots, resource, completedSectionTitles, incompleteSessionsFromPreviousWeek } =
    input;

  const sortedSlots = sortAvailabilitySlots(availabilitySlots);
  const sessions: NewPlanSession[] = [];
  let slotIndex = 0;
  const weekSections: string[] = [];

  // Step 1: Carry over incomplete sessions from previous week (prioritize these)
  for (const incompleteSession of incompleteSessionsFromPreviousWeek) {
    if (slotIndex >= sortedSlots.length) break;

    const slot = sortedSlots[slotIndex];
    sessions.push({
      dayOfWeek: slot.day as DayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      topic: incompleteSession.topic,
      activities: incompleteSession.activities
    });

    if (!weekSections.includes(incompleteSession.topic)) {
      weekSections.push(incompleteSession.topic);
    }

    slotIndex++;
  }

  // Step 2: Get remaining sections from resource (not yet completed)
  const sections = [...(resource.sections || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .filter((section) => !completedSectionTitles.includes(section.title));

  // Step 3: Assign remaining slots to new sections
  let sectionIndex = 0;
  let sectionRemainingMinutes = sections[0]?.estimatedMinutes || 30;

  while (slotIndex < sortedSlots.length && sectionIndex < sections.length) {
    const slot = sortedSlots[slotIndex];
    const currentSection = sections[sectionIndex];

    sessions.push({
      dayOfWeek: slot.day as DayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      topic: currentSection.title,
      activities: currentSection.topics?.length ? currentSection.topics.slice(0, 3) : [`Study ${currentSection.title}`]
    });

    if (!weekSections.includes(currentSection.title)) {
      weekSections.push(currentSection.title);
    }

    sectionRemainingMinutes -= slot.durationMinutes;
    slotIndex++;

    // Move to next section if current one is complete
    if (sectionRemainingMinutes <= 0) {
      sectionIndex++;
      if (sectionIndex < sections.length) {
        sectionRemainingMinutes = sections[sectionIndex].estimatedMinutes || 30;
      }
    }
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  return {
    plan: {
      goalId,
      weekNumber,
      weekStartDate,
      focusArea: weekSections.join(', ') || 'Getting Started',
      totalMinutes,
      completionPercentage: 0
    },
    sessions
  };
}

/**
 * Get the current week number based on a start date
 */
export function getCurrentWeekNumber(startDate: Date): number {
  const now = new Date();
  const start = new Date(startDate);
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Get the start date for a specific week number
 */
export function getWeekStartDate(scheduleStartDate: Date, weekNumber: number): Date {
  const date = new Date(scheduleStartDate);
  date.setDate(date.getDate() + (weekNumber - 1) * 7);
  return date;
}

// ============================================================================
// Session Generation for New Slots
// ============================================================================

export interface NewSlotInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface ExistingSessionInfo {
  topic: string;
  durationMinutes: number;
}

export interface GenerateSessionsForNewSlotsInput {
  /** New slots that need sessions */
  newSlots: NewSlotInput[];
  /** Resource with sections to assign */
  resource: LearningResourceWithSections;
  /** Section titles that are fully completed */
  completedSectionTitles: string[];
  /** All existing sessions across all plans (for calculating time spent) */
  allExistingSessions: ExistingSessionInfo[];
}

export interface GenerateSessionsForNewSlotsResult {
  sessions: NewPlanSession[];
  /** Sections that were assigned to the new sessions */
  assignedSections: string[];
}

/**
 * Generates sessions for new availability slots.
 *
 * - Excludes completed sections
 * - Calculates time already spent on each section from existing sessions
 * - Distributes new slots across sections based on their estimated duration
 * - Moves to the next section when current section's time is exhausted
 *
 * This is a pure function that doesn't have side effects (no DB calls).
 */
export function generateSessionsForNewSlots(input: GenerateSessionsForNewSlotsInput): GenerateSessionsForNewSlotsResult {
  const { newSlots, resource, completedSectionTitles, allExistingSessions } = input;

  if (newSlots.length === 0) {
    return { sessions: [], assignedSections: [] };
  }

  // Get sections that are not completed, sorted by order
  const availableSections = [...(resource.sections || [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .filter((section) => !completedSectionTitles.includes(section.title));

  if (availableSections.length === 0) {
    return { sessions: [], assignedSections: [] };
  }

  // Calculate time already spent on each section from all existing sessions
  const timeSpentBySection = new Map<string, number>();
  for (const session of allExistingSessions) {
    // Only count non-completed sections
    if (!completedSectionTitles.includes(session.topic)) {
      const current = timeSpentBySection.get(session.topic) || 0;
      timeSpentBySection.set(session.topic, current + session.durationMinutes);
    }
  }

  // Find the current section and its remaining time
  let currentSectionIndex = 0;
  let sectionRemainingMinutes = availableSections[0]?.estimatedMinutes || 30;

  // Find where we left off based on total time spent
  for (let i = 0; i < availableSections.length; i++) {
    const section = availableSections[i];
    const timeSpent = timeSpentBySection.get(section.title) || 0;
    const sectionDuration = section.estimatedMinutes || 30;

    if (timeSpent < sectionDuration) {
      // This section still has remaining time
      currentSectionIndex = i;
      sectionRemainingMinutes = sectionDuration - timeSpent;
      break;
    } else if (i === availableSections.length - 1) {
      // All sections covered, stay on last one
      currentSectionIndex = i;
      sectionRemainingMinutes = 0;
    }
  }

  // Sort new slots by day of week and time
  const dayOrder: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6
  };
  const sortedNewSlots = [...newSlots].sort((a, b) => {
    const dayDiff = (dayOrder[a.dayOfWeek] ?? 0) - (dayOrder[b.dayOfWeek] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  // Generate sessions for each new slot
  const sessions: NewPlanSession[] = [];
  const assignedSections = new Set<string>();

  for (const slot of sortedNewSlots) {
    if (currentSectionIndex >= availableSections.length) break;

    const section = availableSections[currentSectionIndex];
    const slotDuration = slot.durationMinutes || 30;

    const newSession: NewPlanSession = {
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slotDuration,
      topic: section.title,
      activities: section.topics?.length ? section.topics.slice(0, 3) : [`Study ${section.title}`]
    };

    sessions.push(newSession);
    assignedSections.add(section.title);

    // Deduct time from current section
    sectionRemainingMinutes -= slotDuration;

    // Move to next section if current one's time is exhausted
    if (sectionRemainingMinutes <= 0 && currentSectionIndex < availableSections.length - 1) {
      currentSectionIndex++;
      sectionRemainingMinutes = availableSections[currentSectionIndex]?.estimatedMinutes || 30;
    }
  }

  return {
    sessions,
    assignedSections: Array.from(assignedSections)
  };
}
