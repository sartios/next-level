import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { goals, users } from '../../lib/db/schema';
import {
  createWeeklyPlan,
  getWeeklyPlanById,
  getWeeklyPlansByGoalId,
  getCurrentWeeklyPlan,
  getWeeklyPlanByWeekNumber,
  updateSessionStatus,
  syncSessionsWithAvailability,
  getIncompleteSessions,
  getCompletedSectionTitles,
  deletePlanSession,
  addPlanSession,
  type NewWeeklyPlan,
  type NewPlanSession,
  type AvailabilitySlot
} from '../../lib/db/weeklyPlanRepository';

describe('weeklyPlanRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testPlanId: string;

  const testSessions: NewPlanSession[] = [
    {
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '09:30',
      durationMinutes: 30,
      topic: 'Introduction to Testing',
      activities: ['Watch video', 'Take notes']
    },
    {
      dayOfWeek: 'Wednesday',
      startTime: '14:00',
      endTime: '14:30',
      durationMinutes: 30,
      topic: 'Introduction to Testing',
      activities: ['Complete quiz']
    },
    {
      dayOfWeek: 'Friday',
      startTime: '10:00',
      endTime: '10:30',
      durationMinutes: 30,
      topic: 'Advanced Testing',
      activities: ['Read documentation']
    }
  ];

  beforeAll(async () => {
    const db = requireDb();

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        role: 'test-user',
        skills: ['testing'],
        careerGoals: ['learn testing']
      })
      .returning();
    testUserId = user.id;

    // Create test goal
    const [goal] = await db
      .insert(goals)
      .values({
        userId: testUserId,
        name: 'Test Goal for Weekly Plan',
        reasoning: 'Testing weekly plan repository'
      })
      .returning();
    testGoalId = goal.id;
  });

  afterAll(async () => {
    const db = requireDb();
    // Clean up test data (cascade will handle related records)
    await db.delete(goals).where(eq(goals.id, testGoalId));
    await db.delete(users).where(eq(users.id, testUserId));
    await closeConnection();
  });

  describe('createWeeklyPlan', () => {
    it('should create a weekly plan with sessions', async () => {
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        focusArea: 'Introduction to Testing',
        totalMinutes: 90
      };

      const result = await createWeeklyPlan(planData, testSessions);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.goalId).toBe(testGoalId);
      expect(result.weekNumber).toBe(1);
      expect(result.focusArea).toBe('Introduction to Testing');
      expect(result.sessions).toHaveLength(3);
      expect(result.completionPercentage).toBe(0);

      testPlanId = result.id;
    });

    it('should replace existing plan for same goal and week', async () => {
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        focusArea: 'Updated Focus Area',
        totalMinutes: 60
      };

      const newSessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Tuesday',
          startTime: '11:00',
          endTime: '12:00',
          durationMinutes: 60,
          topic: 'New Topic',
          activities: ['New activity']
        }
      ];

      const result = await createWeeklyPlan(planData, newSessions);

      expect(result.focusArea).toBe('Updated Focus Area');
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].topic).toBe('New Topic');

      testPlanId = result.id;
    });
  });

  describe('getWeeklyPlanById', () => {
    it('should retrieve a plan by ID with sessions', async () => {
      const result = await getWeeklyPlanById(testPlanId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testPlanId);
      expect(result?.sessions).toBeDefined();
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await getWeeklyPlanById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeUndefined();
    });
  });

  describe('getWeeklyPlansByGoalId', () => {
    it('should retrieve all plans for a goal', async () => {
      const result = await getWeeklyPlansByGoalId(testGoalId);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].goalId).toBe(testGoalId);
    });

    it('should return empty array for goal with no plans', async () => {
      const result = await getWeeklyPlansByGoalId('00000000-0000-0000-0000-000000000000');

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentWeeklyPlan', () => {
    it('should retrieve the most recent plan for a goal', async () => {
      // Create a second week plan
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 2,
        weekStartDate: new Date('2024-01-08'),
        focusArea: 'Week 2 Focus',
        totalMinutes: 60
      };

      await createWeeklyPlan(planData, []);

      const result = await getCurrentWeeklyPlan(testGoalId);

      expect(result).toBeDefined();
      expect(result?.weekNumber).toBe(2);
    });
  });

  describe('getWeeklyPlanByWeekNumber', () => {
    it('should retrieve a plan by goal and week number', async () => {
      const result = await getWeeklyPlanByWeekNumber(testGoalId, 1);

      expect(result).toBeDefined();
      expect(result?.weekNumber).toBe(1);
    });

    it('should return undefined for non-existent week', async () => {
      const result = await getWeeklyPlanByWeekNumber(testGoalId, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('updateSessionStatus', () => {
    let sessionId: string;

    beforeAll(async () => {
      // Create a fresh plan with sessions for status tests
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 3,
        weekStartDate: new Date('2024-01-15'),
        focusArea: 'Status Testing',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);
      sessionId = plan.sessions[0].id;
    });

    it('should update session status to completed', async () => {
      const result = await updateSessionStatus(sessionId, 'completed');

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.completedAt).toBeDefined();
    });

    it('should update session status back to pending', async () => {
      const result = await updateSessionStatus(sessionId, 'pending');

      expect(result).toBeDefined();
      expect(result?.status).toBe('pending');
      expect(result?.completedAt).toBeNull();
    });

    it('should recalculate completion percentage after status update', async () => {
      await updateSessionStatus(sessionId, 'completed');

      const plan = await getWeeklyPlanByWeekNumber(testGoalId, 3);

      // 1 out of 3 sessions completed = 33%
      expect(plan?.completionPercentage).toBe(33);
    });
  });

  describe('syncSessionsWithAvailability', () => {
    let syncPlanId: string;

    beforeAll(async () => {
      // Create a plan with sessions for sync tests
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 4,
        weekStartDate: new Date('2024-01-22'),
        focusArea: 'Sync Testing',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);
      syncPlanId = plan.id;
    });

    it('should remove sessions for deleted slots', async () => {
      // Only keep Monday slot, remove Wednesday and Friday
      const newSlots: AvailabilitySlot[] = [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30' }];

      const result = await syncSessionsWithAvailability(syncPlanId, newSlots);

      expect(result.deletedSessionIds).toHaveLength(2);
      expect(result.remainingSessions).toHaveLength(1);
      expect(result.remainingSessions[0].dayOfWeek).toBe('Monday');
    });

    it('should keep all sessions when slots match', async () => {
      // Create a new plan first
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 5,
        weekStartDate: new Date('2024-01-29'),
        focusArea: 'Keep All Sessions',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);

      const matchingSlots: AvailabilitySlot[] = [
        { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30' },
        { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '14:30' },
        { dayOfWeek: 'Friday', startTime: '10:00', endTime: '10:30' }
      ];

      const result = await syncSessionsWithAvailability(plan.id, matchingSlots);

      expect(result.deletedSessionIds).toHaveLength(0);
      expect(result.remainingSessions).toHaveLength(3);
    });

    it('should remove all sessions when no slots match', async () => {
      // Create a new plan
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 6,
        weekStartDate: new Date('2024-02-05'),
        focusArea: 'Remove All Sessions',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);

      const nonMatchingSlots: AvailabilitySlot[] = [{ dayOfWeek: 'Saturday', startTime: '08:00', endTime: '09:00' }];

      const result = await syncSessionsWithAvailability(plan.id, nonMatchingSlots);

      expect(result.deletedSessionIds).toHaveLength(3);
      expect(result.remainingSessions).toHaveLength(0);
    });

    it('should identify new slots that need sessions', async () => {
      // Create a plan with one session
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 11,
        weekStartDate: new Date('2024-03-11'),
        focusArea: 'New Slots Test',
        totalMinutes: 30
      };

      const singleSession: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '09:30',
          durationMinutes: 30,
          topic: 'Existing Topic',
          activities: ['Activity 1']
        }
      ];

      const plan = await createWeeklyPlan(planData, singleSession);

      // Sync with slots that include the existing one plus new ones
      const slotsWithNew: AvailabilitySlot[] = [
        { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }, // existing
        { dayOfWeek: 'Tuesday', startTime: '14:00', endTime: '14:30', durationMinutes: 30 }, // new
        { dayOfWeek: 'Thursday', startTime: '10:00', endTime: '10:30', durationMinutes: 30 } // new
      ];

      const result = await syncSessionsWithAvailability(plan.id, slotsWithNew);

      expect(result.deletedSessionIds).toHaveLength(0);
      expect(result.remainingSessions).toHaveLength(1);
      expect(result.newSlots).toHaveLength(2);
      expect(result.newSlots[0].dayOfWeek).toBe('Tuesday');
      expect(result.newSlots[1].dayOfWeek).toBe('Thursday');
    });

    it('should retain completed sessions when their slots are removed', async () => {
      // Create a plan with sessions
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 12,
        weekStartDate: new Date('2024-03-18'),
        focusArea: 'Retain Completed Sessions Test',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);

      // Mark the Monday session as completed
      const mondaySession = plan.sessions.find((s) => s.dayOfWeek === 'Monday');
      await updateSessionStatus(mondaySession!.id, 'completed');

      // Sync with slots that don't include any of the original slots
      const newSlots: AvailabilitySlot[] = [{ dayOfWeek: 'Saturday', startTime: '10:00', endTime: '10:30' }];

      const result = await syncSessionsWithAvailability(plan.id, newSlots);

      // Only pending sessions (Wednesday, Friday) should be deleted
      expect(result.deletedSessionIds).toHaveLength(2);
      // The completed Monday session should be retained
      expect(result.remainingSessions).toHaveLength(1);
      expect(result.remainingSessions[0].dayOfWeek).toBe('Monday');
      expect(result.remainingSessions[0].status).toBe('completed');
    });

    it('should only delete pending sessions, not completed ones', async () => {
      // Create a plan with sessions
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 13,
        weekStartDate: new Date('2024-03-25'),
        focusArea: 'Mixed Status Test',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);

      // Mark Monday and Friday sessions as completed
      const mondaySession = plan.sessions.find((s) => s.dayOfWeek === 'Monday');
      const fridaySession = plan.sessions.find((s) => s.dayOfWeek === 'Friday');
      await updateSessionStatus(mondaySession!.id, 'completed');
      await updateSessionStatus(fridaySession!.id, 'completed');

      // Remove all slots
      const emptySlots: AvailabilitySlot[] = [];

      const result = await syncSessionsWithAvailability(plan.id, emptySlots);

      // Only the pending Wednesday session should be deleted
      expect(result.deletedSessionIds).toHaveLength(1);
      // Both completed sessions should be retained
      expect(result.remainingSessions).toHaveLength(2);
      expect(result.remainingSessions.every((s) => s.status === 'completed')).toBe(true);
    });
  });

  describe('getIncompleteSessions', () => {
    let incompletePlanId: string;
    let completedSessionId: string;

    beforeAll(async () => {
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 7,
        weekStartDate: new Date('2024-02-12'),
        focusArea: 'Incomplete Sessions Test',
        totalMinutes: 90
      };

      const plan = await createWeeklyPlan(planData, testSessions);
      incompletePlanId = plan.id;

      // Mark one session as completed
      completedSessionId = plan.sessions[0].id;
      await updateSessionStatus(completedSessionId, 'completed');
    });

    it('should return only incomplete sessions', async () => {
      const result = await getIncompleteSessions(incompletePlanId);

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.status !== 'completed')).toBe(true);
    });
  });

  describe('getCompletedSectionTitles', () => {
    beforeAll(async () => {
      // Create a plan with all sessions for one topic completed
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 8,
        weekStartDate: new Date('2024-02-19'),
        focusArea: 'Completed Sections Test',
        totalMinutes: 60
      };

      const sessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '09:30',
          durationMinutes: 30,
          topic: 'Fully Completed Topic',
          activities: ['Activity 1']
        },
        {
          dayOfWeek: 'Tuesday',
          startTime: '09:00',
          endTime: '09:30',
          durationMinutes: 30,
          topic: 'Fully Completed Topic',
          activities: ['Activity 2']
        }
      ];

      const plan = await createWeeklyPlan(planData, sessions);

      // Mark both sessions as completed
      for (const session of plan.sessions) {
        await updateSessionStatus(session.id, 'completed');
      }
    });

    it('should return titles of fully completed sections', async () => {
      const result = await getCompletedSectionTitles(testGoalId);

      expect(result).toContain('Fully Completed Topic');
    });
  });

  describe('deletePlanSession', () => {
    it('should delete a specific session', async () => {
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 9,
        weekStartDate: new Date('2024-02-26'),
        focusArea: 'Delete Session Test',
        totalMinutes: 60
      };

      const plan = await createWeeklyPlan(planData, testSessions);
      const sessionToDelete = plan.sessions[0].id;

      const result = await deletePlanSession(sessionToDelete);

      expect(result).toBe(true);

      const updatedPlan = await getWeeklyPlanById(plan.id);
      expect(updatedPlan?.sessions).toHaveLength(2);
    });
  });

  describe('addPlanSession', () => {
    it('should add a new session to an existing plan', async () => {
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 10,
        weekStartDate: new Date('2024-03-04'),
        focusArea: 'Add Session Test',
        totalMinutes: 30
      };

      const plan = await createWeeklyPlan(planData, []);

      const newSession: NewPlanSession = {
        dayOfWeek: 'Thursday',
        startTime: '15:00',
        endTime: '15:30',
        durationMinutes: 30,
        topic: 'New Session Topic',
        activities: ['New activity']
      };

      const result = await addPlanSession(plan.id, newSession);

      expect(result).toBeDefined();
      expect(result.dayOfWeek).toBe('Thursday');
      expect(result.topic).toBe('New Session Topic');

      const updatedPlan = await getWeeklyPlanById(plan.id);
      expect(updatedPlan?.sessions).toHaveLength(1);
    });
  });
});
