import { eq, and, desc } from 'drizzle-orm';
import { requireDb } from './index';
import { weeklyPlans, planSessions, type DayOfWeek, type PlanSessionStatus } from './schema';

// ============================================================================
// Types
// ============================================================================

export interface WeeklyPlan {
  id: string;
  goalId: string;
  weekNumber: number;
  weekStartDate: Date;
  focusArea: string;
  totalMinutes: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanSession {
  id: string;
  weeklyPlanId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  topic: string;
  activities: string[];
  status: PlanSessionStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyPlanWithSessions extends WeeklyPlan {
  sessions: PlanSession[];
}

export interface NewWeeklyPlan {
  goalId: string;
  weekNumber: number;
  weekStartDate: Date;
  focusArea: string;
  totalMinutes: number;
  completionPercentage?: number;
}

export interface NewPlanSession {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  topic: string;
  activities: string[];
}

// ============================================================================
// Weekly Plans
// ============================================================================

/**
 * Create a new weekly plan with sessions
 * If a plan already exists for the same goal and week, it will be replaced
 */
export async function createWeeklyPlan(planData: NewWeeklyPlan, sessions: NewPlanSession[]): Promise<WeeklyPlanWithSessions> {
  const db = requireDb();

  // Check if a plan already exists for this goal and week
  const existingPlan = await getWeeklyPlanByWeekNumber(planData.goalId, planData.weekNumber);
  if (existingPlan) {
    // Delete the existing plan (cascade will delete sessions)
    await deleteWeeklyPlan(existingPlan.id);
  }

  const [insertedPlan] = await db
    .insert(weeklyPlans)
    .values({
      goalId: planData.goalId,
      weekNumber: planData.weekNumber,
      weekStartDate: planData.weekStartDate,
      focusArea: planData.focusArea,
      totalMinutes: planData.totalMinutes,
      completionPercentage: planData.completionPercentage ?? 0
    })
    .returning();

  const insertedSessions: PlanSession[] = [];
  if (sessions.length > 0) {
    const sessionsToInsert = sessions.map((session) => ({
      weeklyPlanId: insertedPlan.id,
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      topic: session.topic,
      activities: session.activities
    }));

    const results = await db.insert(planSessions).values(sessionsToInsert).returning();
    insertedSessions.push(...results);
  }

  return { ...insertedPlan, sessions: insertedSessions };
}

/**
 * Get a weekly plan by ID with sessions
 */
export async function getWeeklyPlanById(id: string): Promise<WeeklyPlanWithSessions | undefined> {
  const db = requireDb();
  const results = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, id)).limit(1);

  if (results.length === 0) return undefined;

  const plan = results[0];
  const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, id));

  return { ...plan, sessions };
}

/**
 * Get all weekly plans for a goal
 */
export async function getWeeklyPlansByGoalId(goalId: string): Promise<WeeklyPlanWithSessions[]> {
  const db = requireDb();
  const plans = await db.select().from(weeklyPlans).where(eq(weeklyPlans.goalId, goalId)).orderBy(desc(weeklyPlans.weekNumber));

  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const allSessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, planIds[0])); // TODO: Use inArray for multiple

  // Group sessions by plan
  const sessionsByPlan = new Map<string, PlanSession[]>();
  for (const session of allSessions) {
    const existing = sessionsByPlan.get(session.weeklyPlanId) || [];
    existing.push(session);
    sessionsByPlan.set(session.weeklyPlanId, existing);
  }

  // Fetch all sessions for all plans
  const plansWithSessions: WeeklyPlanWithSessions[] = [];
  for (const plan of plans) {
    const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, plan.id));
    plansWithSessions.push({ ...plan, sessions });
  }

  return plansWithSessions;
}

/**
 * Get the current week's plan for a goal
 */
export async function getCurrentWeeklyPlan(goalId: string): Promise<WeeklyPlanWithSessions | undefined> {
  const db = requireDb();

  // Get the most recent plan (highest week number)
  const results = await db.select().from(weeklyPlans).where(eq(weeklyPlans.goalId, goalId)).orderBy(desc(weeklyPlans.weekNumber)).limit(1);

  if (results.length === 0) return undefined;

  const plan = results[0];
  const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, plan.id));

  return { ...plan, sessions };
}

/**
 * Get weekly plan by goal and week number
 */
export async function getWeeklyPlanByWeekNumber(goalId: string, weekNumber: number): Promise<WeeklyPlanWithSessions | undefined> {
  const db = requireDb();

  const results = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.goalId, goalId), eq(weeklyPlans.weekNumber, weekNumber)))
    .limit(1);

  if (results.length === 0) return undefined;

  const plan = results[0];
  const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, plan.id));

  return { ...plan, sessions };
}

/**
 * Update a weekly plan
 */
export async function updateWeeklyPlan(
  id: string,
  data: Partial<Pick<NewWeeklyPlan, 'focusArea' | 'totalMinutes' | 'completionPercentage'>>
): Promise<WeeklyPlan | undefined> {
  const db = requireDb();

  const [updated] = await db
    .update(weeklyPlans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(weeklyPlans.id, id))
    .returning();

  return updated;
}

/**
 * Delete a weekly plan and its sessions
 */
export async function deleteWeeklyPlan(id: string): Promise<boolean> {
  const db = requireDb();
  const result = await db.delete(weeklyPlans).where(eq(weeklyPlans.id, id)).returning();
  return result.length > 0;
}

// ============================================================================
// Plan Sessions
// ============================================================================

/**
 * Update a plan session's status
 */
export async function updateSessionStatus(sessionId: string, status: PlanSessionStatus): Promise<PlanSession | undefined> {
  const db = requireDb();

  const updateData: { status: PlanSessionStatus; completedAt?: Date | null; updatedAt: Date } = {
    status,
    updatedAt: new Date()
  };

  if (status === 'completed') {
    updateData.completedAt = new Date();
  } else {
    updateData.completedAt = null;
  }

  const [updated] = await db.update(planSessions).set(updateData).where(eq(planSessions.id, sessionId)).returning();

  // Update the weekly plan's completion percentage
  if (updated) {
    await recalculateCompletionPercentage(updated.weeklyPlanId);
  }

  return updated;
}

/**
 * Recalculate and update the completion percentage for a weekly plan
 */
async function recalculateCompletionPercentage(weeklyPlanId: string): Promise<void> {
  const db = requireDb();

  const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, weeklyPlanId));

  if (sessions.length === 0) return;

  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const completionPercentage = Math.round((completedCount / sessions.length) * 100);

  await db.update(weeklyPlans).set({ completionPercentage, updatedAt: new Date() }).where(eq(weeklyPlans.id, weeklyPlanId));
}

/**
 * Get a plan session by ID
 */
export async function getPlanSessionById(sessionId: string): Promise<PlanSession | undefined> {
  const db = requireDb();
  const results = await db.select().from(planSessions).where(eq(planSessions.id, sessionId)).limit(1);
  return results[0];
}

/**
 * Delete a specific plan session by ID
 */
export async function deletePlanSession(sessionId: string): Promise<boolean> {
  const db = requireDb();
  const result = await db.delete(planSessions).where(eq(planSessions.id, sessionId)).returning();

  // Recalculate completion percentage if session was deleted
  if (result.length > 0) {
    await recalculateCompletionPercentage(result[0].weeklyPlanId);
  }

  return result.length > 0;
}

/**
 * Add a new session to an existing weekly plan
 */
export async function addPlanSession(weeklyPlanId: string, session: NewPlanSession): Promise<PlanSession> {
  const db = requireDb();

  const [inserted] = await db
    .insert(planSessions)
    .values({
      weeklyPlanId,
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      topic: session.topic,
      activities: session.activities
    })
    .returning();

  await recalculateCompletionPercentage(weeklyPlanId);

  return inserted;
}

export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
}

/**
 * Get incomplete (not completed) sessions from a weekly plan
 */
export async function getIncompleteSessions(weeklyPlanId: string): Promise<PlanSession[]> {
  const db = requireDb();
  const sessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, weeklyPlanId));

  return sessions.filter((s) => s.status !== 'completed');
}

/**
 * Get completed section titles from all plans for a goal
 * A section is considered completed when all its sessions are completed
 */
export async function getCompletedSectionTitles(goalId: string): Promise<string[]> {
  const plans = await getWeeklyPlansByGoalId(goalId);
  const completedTitles = new Set<string>();

  for (const plan of plans) {
    // Group sessions by topic
    const sessionsByTopic = new Map<string, PlanSession[]>();
    for (const session of plan.sessions) {
      const existing = sessionsByTopic.get(session.topic) || [];
      existing.push(session);
      sessionsByTopic.set(session.topic, existing);
    }

    // Check if all sessions for a topic are completed
    for (const [topic, sessions] of sessionsByTopic) {
      const allCompleted = sessions.every((s) => s.status === 'completed');
      if (allCompleted) {
        completedTitles.add(topic);
      }
    }
  }

  return Array.from(completedTitles);
}

export interface SyncResult {
  deletedSessionIds: string[];
  remainingSessions: PlanSession[];
  newSlots: AvailabilitySlot[];
}

/**
 * Sync plan sessions with availability slots for a weekly plan.
 * - Removes pending sessions that no longer have matching slots
 * - Retains completed sessions even if their slot is removed
 * - Identifies new slots that don't have sessions
 * Returns deleted session IDs, remaining sessions, and new slots that need sessions.
 */
export async function syncSessionsWithAvailability(weeklyPlanId: string, availableSlots: AvailabilitySlot[]): Promise<SyncResult> {
  const db = requireDb();

  const existingSessions = await db.select().from(planSessions).where(eq(planSessions.weeklyPlanId, weeklyPlanId));

  const deletedSessionIds: string[] = [];
  const remainingSessions: PlanSession[] = [];

  // Find sessions to delete (no matching slot and not completed)
  for (const session of existingSessions) {
    const hasMatchingSlot = availableSlots.some(
      (slot) => slot.dayOfWeek === session.dayOfWeek && slot.startTime === session.startTime && slot.endTime === session.endTime
    );

    if (!hasMatchingSlot && session.status === 'pending') {
      // Only delete pending sessions - retain completed sessions
      await db.delete(planSessions).where(eq(planSessions.id, session.id));
      deletedSessionIds.push(session.id);
    } else {
      remainingSessions.push(session);
    }
  }

  // Find new slots (no matching session)
  const newSlots: AvailabilitySlot[] = availableSlots.filter((slot) => {
    const hasMatchingSession = existingSessions.some(
      (session) => session.dayOfWeek === slot.dayOfWeek && session.startTime === slot.startTime && session.endTime === slot.endTime
    );
    return !hasMatchingSession;
  });

  if (deletedSessionIds.length > 0) {
    await recalculateCompletionPercentage(weeklyPlanId);
  }

  return { deletedSessionIds, remainingSessions, newSlots };
}
