import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, goals } from '../../lib/db/schema';
import {
  createSchedule,
  getScheduleById,
  getScheduleByUserAndGoal,
  getSchedulesByUserId,
  updateSchedule,
  deleteSchedule,
  upsertSchedule,
  type NewSchedule,
  type NewScheduleSlot
} from '../../lib/db/scheduleRepository';

describe('scheduleRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testScheduleId: string;

  const testSlots: NewScheduleSlot[] = [
    { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
    { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 }
  ];

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;

    const [goal] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Test Goal for Schedules', reasoning: 'Testing schedule repository' })
      .returning();
    testGoalId = goal.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await closeConnection();
  });

  it('creates schedule with slots', async () => {
    const scheduleData: NewSchedule = {
      userId: testUserId,
      goalId: testGoalId,
      startDate: new Date('2024-01-01'),
      weeklyHours: 5
    };

    const result = await createSchedule(scheduleData, testSlots);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.userId).toBe(testUserId);
    expect(result.goalId).toBe(testGoalId);
    expect(result.weeklyHours).toBe(5);
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0].dayOfWeek).toBeDefined();

    testScheduleId = result.id;
  });

  it('creates schedule with empty slots', async () => {
    const db = requireDb();
    const [goal2] = await db.insert(goals).values({ userId: testUserId, name: 'Empty Slots Goal', reasoning: 'Test' }).returning();

    const result = await createSchedule({ userId: testUserId, goalId: goal2.id, startDate: new Date('2024-01-01'), weeklyHours: 0 }, []);

    expect(result).toBeDefined();
    expect(result.slots).toHaveLength(0);
  });

  it('retrieves schedule by id with slots', async () => {
    const result = await getScheduleById(testScheduleId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(testScheduleId);
    expect(result?.slots).toHaveLength(2);
  });

  it('retrieves schedule by user and goal', async () => {
    const result = await getScheduleByUserAndGoal(testUserId, testGoalId);

    expect(result).toBeDefined();
    expect(result?.userId).toBe(testUserId);
    expect(result?.goalId).toBe(testGoalId);
    expect(result?.slots.length).toBeGreaterThanOrEqual(1);
  });

  it('returns undefined for non-existent user/goal pair', async () => {
    const result = await getScheduleByUserAndGoal(testUserId, '00000000-0000-0000-0000-000000000000');

    expect(result).toBeUndefined();
  });

  it('retrieves schedules by user id', async () => {
    const result = await getSchedulesByUserId(testUserId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].userId).toBe(testUserId);
  });

  it('updates schedule and replaces slots', async () => {
    const newSlots: NewScheduleSlot[] = [{ dayOfWeek: 'Friday', startTime: '16:00', endTime: '17:00', durationMinutes: 60 }];

    const result = await updateSchedule(testScheduleId, { weeklyHours: 3 }, newSlots);

    expect(result).toBeDefined();
    expect(result?.weeklyHours).toBe(3);
    expect(result?.slots).toHaveLength(1);
    expect(result?.slots[0].dayOfWeek).toBe('Friday');
  });

  it('updates schedule without touching slots', async () => {
    const result = await updateSchedule(testScheduleId, { weeklyHours: 10 });

    expect(result).toBeDefined();
    expect(result?.weeklyHours).toBe(10);
    expect(result?.slots).toHaveLength(1);
    expect(result?.slots[0].dayOfWeek).toBe('Friday');
  });

  it('upsert creates when none exists, updates when exists', async () => {
    const db = requireDb();
    const [goal3] = await db.insert(goals).values({ userId: testUserId, name: 'Upsert Goal', reasoning: 'Test upsert' }).returning();

    const scheduleData: NewSchedule = {
      userId: testUserId,
      goalId: goal3.id,
      startDate: new Date('2024-02-01'),
      weeklyHours: 4
    };
    const slots: NewScheduleSlot[] = [{ dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '11:00', durationMinutes: 60 }];

    // First call creates
    const created = await upsertSchedule(scheduleData, slots);
    expect(created.weeklyHours).toBe(4);
    expect(created.slots).toHaveLength(1);

    // Second call updates
    const updatedData: NewSchedule = { ...scheduleData, weeklyHours: 8 };
    const newSlots: NewScheduleSlot[] = [
      { dayOfWeek: 'Thursday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
      { dayOfWeek: 'Saturday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }
    ];

    const updated = await upsertSchedule(updatedData, newSlots);
    expect(updated.weeklyHours).toBe(8);
    expect(updated.slots).toHaveLength(2);
  });
});
