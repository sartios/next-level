import { eq, and } from 'drizzle-orm';
import { requireDb } from './index';
import { schedules, scheduleSlots, DayOfWeek } from './schema';

export interface Schedule {
  id: string;
  userId: string;
  goalId: string;
  startDate: Date;
  weeklyHours: number;
  targetCompletionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleSlot {
  id: string;
  scheduleId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface ScheduleWithSlots extends Schedule {
  slots: ScheduleSlot[];
}

export interface NewSchedule {
  userId: string;
  goalId: string;
  startDate: Date;
  weeklyHours: number;
  targetCompletionDate?: Date | null;
}

export interface NewScheduleSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

/**
 * Create a new schedule with slots
 */
export async function createSchedule(
  scheduleData: NewSchedule,
  slots: NewScheduleSlot[]
): Promise<ScheduleWithSlots> {
  const db = requireDb();

  // Insert schedule
  const [inserted] = await db
    .insert(schedules)
    .values({
      userId: scheduleData.userId,
      goalId: scheduleData.goalId,
      startDate: scheduleData.startDate,
      weeklyHours: scheduleData.weeklyHours,
      targetCompletionDate: scheduleData.targetCompletionDate ?? null
    })
    .returning();

  // Insert slots
  const insertedSlots: ScheduleSlot[] = [];
  if (slots.length > 0) {
    const slotsToInsert = slots.map((slot) => ({
      scheduleId: inserted.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes
    }));

    const results = await db.insert(scheduleSlots).values(slotsToInsert).returning();
    insertedSlots.push(...results);
  }

  return { ...inserted, slots: insertedSlots };
}

/**
 * Get a schedule by ID with its slots
 */
export async function getScheduleById(id: string): Promise<ScheduleWithSlots | undefined> {
  const db = requireDb();
  const results = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);

  if (results.length === 0) return undefined;

  const schedule = results[0];
  const slots = await db.select().from(scheduleSlots).where(eq(scheduleSlots.scheduleId, id));

  return { ...schedule, slots };
}

/**
 * Get schedule by user and goal
 */
export async function getScheduleByUserAndGoal(
  userId: string,
  goalId: string
): Promise<ScheduleWithSlots | undefined> {
  const db = requireDb();
  const results = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.userId, userId), eq(schedules.goalId, goalId)))
    .limit(1);

  if (results.length === 0) return undefined;

  const schedule = results[0];
  const slots = await db.select().from(scheduleSlots).where(eq(scheduleSlots.scheduleId, schedule.id));

  return { ...schedule, slots };
}

/**
 * Get all schedules for a user
 */
export async function getSchedulesByUserId(userId: string): Promise<Schedule[]> {
  const db = requireDb();
  return db.select().from(schedules).where(eq(schedules.userId, userId));
}

/**
 * Update a schedule (replaces slots)
 */
export async function updateSchedule(
  id: string,
  scheduleData: Partial<Omit<NewSchedule, 'userId' | 'goalId'>>,
  newSlots?: NewScheduleSlot[]
): Promise<ScheduleWithSlots | undefined> {
  const db = requireDb();

  // Update schedule
  const [updated] = await db
    .update(schedules)
    .set({ ...scheduleData, updatedAt: new Date() })
    .where(eq(schedules.id, id))
    .returning();

  if (!updated) return undefined;

  // If new slots provided, replace existing slots
  let slots: ScheduleSlot[] = [];
  if (newSlots !== undefined) {
    // Delete existing slots
    await db.delete(scheduleSlots).where(eq(scheduleSlots.scheduleId, id));

    // Insert new slots
    if (newSlots.length > 0) {
      const slotsToInsert = newSlots.map((slot) => ({
        scheduleId: id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: slot.durationMinutes
      }));

      slots = await db.insert(scheduleSlots).values(slotsToInsert).returning();
    }
  } else {
    // Keep existing slots
    slots = await db.select().from(scheduleSlots).where(eq(scheduleSlots.scheduleId, id));
  }

  return { ...updated, slots };
}

/**
 * Delete a schedule and its slots
 */
export async function deleteSchedule(id: string): Promise<boolean> {
  const db = requireDb();
  const result = await db.delete(schedules).where(eq(schedules.id, id)).returning();
  return result.length > 0;
}

/**
 * Upsert schedule - create or update if exists for user/goal
 */
export async function upsertSchedule(
  scheduleData: NewSchedule,
  slots: NewScheduleSlot[]
): Promise<ScheduleWithSlots> {
  const existing = await getScheduleByUserAndGoal(scheduleData.userId, scheduleData.goalId);

  if (existing) {
    const updated = await updateSchedule(
      existing.id,
      {
        startDate: scheduleData.startDate,
        weeklyHours: scheduleData.weeklyHours,
        targetCompletionDate: scheduleData.targetCompletionDate
      },
      slots
    );
    return updated!;
  }

  return createSchedule(scheduleData, slots);
}
