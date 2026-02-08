import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, goals, learningResources, learningResourceSections } from '../../lib/db/schema';
import { upsertSchedule } from '../../lib/db/scheduleRepository';
import { createWeeklyPlan, updateSessionStatus, type NewWeeklyPlan, type NewPlanSession } from '../../lib/db/weeklyPlanRepository';
import { syncWeeklyPlanWithSchedule } from '../../lib/services/weeklyPlanService';

describe('weeklyPlanService integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testResourceId: string;

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

    // Create test resource with sections
    const [resource] = await db
      .insert(learningResources)
      .values({
        title: 'Test Resource for Weekly Plan Service',
        description: 'A test resource',
        resourceType: 'course',
        url: 'https://example.com/test-weekly-plan-service',
        provider: 'Test Provider',
        totalHours: 10
      })
      .returning();
    testResourceId = resource.id;

    // Create resource sections
    await db.insert(learningResourceSections).values([
      {
        resourceId: testResourceId,
        title: 'Section 1: Introduction',
        orderIndex: 0,
        estimatedMinutes: 60,
        topics: ['Topic 1A', 'Topic 1B']
      },
      {
        resourceId: testResourceId,
        title: 'Section 2: Basics',
        orderIndex: 1,
        estimatedMinutes: 90,
        topics: ['Topic 2A', 'Topic 2B']
      },
      {
        resourceId: testResourceId,
        title: 'Section 3: Advanced',
        orderIndex: 2,
        estimatedMinutes: 120,
        topics: ['Topic 3A', 'Topic 3B']
      }
    ]);

    // Create test goal with selected resource
    const [goal] = await db
      .insert(goals)
      .values({
        userId: testUserId,
        name: 'Test Goal for Weekly Plan Service',
        reasoning: 'Testing weekly plan service',
        selectedResourceId: testResourceId
      })
      .returning();
    testGoalId = goal.id;
  });

  afterAll(async () => {
    const db = requireDb();
    // Clean up test data (cascade will handle related records)
    await db.delete(goals).where(eq(goals.id, testGoalId));
    await db.delete(learningResources).where(eq(learningResources.id, testResourceId));
    await db.delete(users).where(eq(users.id, testUserId));
    await closeConnection();
  });

  describe('syncWeeklyPlanWithSchedule', () => {
    beforeEach(async () => {
      const db = requireDb();
      // Clean up any existing weekly plans for this goal before each test
      await db.execute(`DELETE FROM weekly_plans WHERE goal_id = '${testGoalId}'`);
      // Clean up any existing schedules
      await db.execute(`DELETE FROM schedules WHERE goal_id = '${testGoalId}'`);
    });

    it('should return null when goal has no selectedResourceId', async () => {
      const db = requireDb();

      // Create a goal without selectedResourceId
      const [goalNoResource] = await db
        .insert(goals)
        .values({
          userId: testUserId,
          name: 'Goal without resource',
          reasoning: 'Testing'
        })
        .returning();

      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: goalNoResource.id,
          startDate: new Date(),
          weeklyHours: 5,
          targetCompletionDate: null
        },
        [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }]
      );

      const result = await syncWeeklyPlanWithSchedule({
        goalId: goalNoResource.id,
        schedule
      });

      expect(result).toBeNull();

      // Cleanup
      await db.delete(goals).where(eq(goals.id, goalNoResource.id));
    });

    it('should create a new plan when no plan exists for current week', async () => {
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 3,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 }
        ]
      );

      const result = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      expect(result).not.toBeNull();
      expect(result?.action).toBe('created');
      expect(result?.weekNumber).toBe(1);
      expect(result?.plan).toBeDefined();
      expect(result?.plan?.sessions.length).toBe(2);
    });

    it('should sync existing plan when slots change', async () => {
      // First create a schedule and plan
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 3,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 }
        ]
      );

      // Create initial plan
      const createResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });
      expect(createResult?.action).toBe('created');

      // Now update slots - remove Wednesday, add Friday
      const updatedSchedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 3,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Friday', startTime: '10:00', endTime: '11:00', durationMinutes: 60 }
        ]
      );

      const syncResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule: updatedSchedule
      });

      expect(syncResult).not.toBeNull();
      expect(syncResult?.action).toBe('synced');
      expect(syncResult?.syncResult).toBeDefined();
      expect(syncResult?.syncResult?.deletedSessionIds.length).toBe(1); // Wednesday removed
      expect(syncResult?.syncResult?.addedSessionCount).toBe(1); // Friday added
    });

    it('should retain completed sessions but delete pending ones when slots are removed', async () => {
      // Create schedule and plan with 2 slots
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 2,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }
        ]
      );

      const createResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      // Mark Monday as completed, Tuesday stays pending
      const mondaySession = createResult?.plan?.sessions.find((s) => s.dayOfWeek === 'Monday');
      if (mondaySession) {
        await updateSessionStatus(mondaySession.id, 'completed');
      }

      // Remove both slots, add a new one
      const updatedSchedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 1,
          targetCompletionDate: null
        },
        [{ dayOfWeek: 'Friday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }]
      );

      const syncResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule: updatedSchedule
      });

      expect(syncResult?.action).toBe('synced');
      // Tuesday (pending) deleted, Monday (completed) retained
      expect(syncResult?.syncResult?.deletedSessionIds.length).toBe(1);
      expect(syncResult?.syncResult?.remainingSessionCount).toBe(1);
    });

    it('should add sessions for new slots', async () => {
      // Create initial schedule with one slot
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 1,
          targetCompletionDate: null
        },
        [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 }]
      );

      await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      // Add more slots
      const updatedSchedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 3,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 },
          { dayOfWeek: 'Friday', startTime: '10:00', endTime: '11:00', durationMinutes: 60 }
        ]
      );

      const syncResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule: updatedSchedule
      });

      expect(syncResult?.action).toBe('synced');
      expect(syncResult?.syncResult?.addedSessionCount).toBe(2); // Wednesday and Friday added
      expect(syncResult?.plan?.sessions.length).toBe(3); // Total 3 sessions
    });

    it('should not delete sessions when slots remain unchanged', async () => {
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: new Date(),
          weeklyHours: 2,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 }
        ]
      );

      // Create initial plan
      await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      // Sync again with same slots
      const syncResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      expect(syncResult?.action).toBe('synced');
      expect(syncResult?.syncResult?.deletedSessionIds.length).toBe(0);
      expect(syncResult?.syncResult?.addedSessionCount).toBe(0);
      expect(syncResult?.syncResult?.remainingSessionCount).toBe(2);
    });

    it('should include incomplete sessions from previous week when creating new week plan', async () => {
      // Create a schedule that started a week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Manually create a week 1 plan with incomplete sessions
      const planData: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 1,
        weekStartDate: oneWeekAgo,
        focusArea: 'Section 1: Introduction',
        totalMinutes: 60
      };

      const sessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
          topic: 'Section 1: Introduction',
          activities: ['Topic 1A', 'Topic 1B']
        }
      ];

      await createWeeklyPlan(planData, sessions);

      // Now create schedule for current week (week 2)
      const schedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: oneWeekAgo,
          weeklyHours: 2,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '15:00', durationMinutes: 60 }
        ]
      );

      const result = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule
      });

      expect(result?.action).toBe('created');
      expect(result?.weekNumber).toBe(2);
      // First session should carry over the incomplete topic from week 1
      const firstSession = result?.plan?.sessions[0];
      expect(firstSession?.topic).toBe('Section 1: Introduction');
    });

    it('should leave previous week plans intact when schedule changes', async () => {
      // Create a schedule that started 2 weeks ago
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Create week 1 plan (2 weeks ago)
      const week1Plan: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 1,
        weekStartDate: twoWeeksAgo,
        focusArea: 'Section 1: Introduction',
        totalMinutes: 120
      };

      const week1Sessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
          topic: 'Section 1: Introduction',
          activities: ['Topic 1A']
        },
        {
          dayOfWeek: 'Wednesday',
          startTime: '14:00',
          endTime: '15:00',
          durationMinutes: 60,
          topic: 'Section 1: Introduction',
          activities: ['Topic 1B']
        }
      ];

      const savedWeek1 = await createWeeklyPlan(week1Plan, week1Sessions);
      // Mark week 1 sessions as completed
      for (const session of savedWeek1.sessions) {
        await updateSessionStatus(session.id, 'completed');
      }

      // Create week 2 plan (1 week ago)
      const week2Plan: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 2,
        weekStartDate: oneWeekAgo,
        focusArea: 'Section 2: Basics',
        totalMinutes: 120
      };

      const week2Sessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
          topic: 'Section 2: Basics',
          activities: ['Topic 2A']
        },
        {
          dayOfWeek: 'Wednesday',
          startTime: '14:00',
          endTime: '15:00',
          durationMinutes: 60,
          topic: 'Section 2: Basics',
          activities: ['Topic 2B']
        }
      ];

      const savedWeek2 = await createWeeklyPlan(week2Plan, week2Sessions);

      // Create week 3 plan (current week)
      const week3Plan: NewWeeklyPlan = {
        goalId: testGoalId,
        weekNumber: 3,
        weekStartDate: new Date(),
        focusArea: 'Section 3: Advanced',
        totalMinutes: 120
      };

      const week3Sessions: NewPlanSession[] = [
        {
          dayOfWeek: 'Monday',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
          topic: 'Section 3: Advanced',
          activities: ['Topic 3A']
        },
        {
          dayOfWeek: 'Wednesday',
          startTime: '14:00',
          endTime: '15:00',
          durationMinutes: 60,
          topic: 'Section 3: Advanced',
          activities: ['Topic 3B']
        }
      ];

      await createWeeklyPlan(week3Plan, week3Sessions);

      // Now user changes their schedule - remove Wednesday, add Friday
      const updatedSchedule = await upsertSchedule(
        {
          userId: testUserId,
          goalId: testGoalId,
          startDate: twoWeeksAgo,
          weeklyHours: 2,
          targetCompletionDate: null
        },
        [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          { dayOfWeek: 'Friday', startTime: '10:00', endTime: '11:00', durationMinutes: 60 }
        ]
      );

      const syncResult = await syncWeeklyPlanWithSchedule({
        goalId: testGoalId,
        schedule: updatedSchedule
      });

      // Verify only current week (week 3) was synced
      expect(syncResult?.action).toBe('synced');
      expect(syncResult?.weekNumber).toBe(3);

      // Verify week 1 plan is unchanged
      const { getWeeklyPlanByWeekNumber } = await import('../../lib/db/weeklyPlanRepository');
      const week1After = await getWeeklyPlanByWeekNumber(testGoalId, 1);
      expect(week1After?.sessions.length).toBe(2);
      expect(week1After?.sessions[0].dayOfWeek).toBe('Monday');
      expect(week1After?.sessions[1].dayOfWeek).toBe('Wednesday');
      expect(week1After?.id).toBe(savedWeek1.id);

      // Verify week 2 plan is unchanged
      const week2After = await getWeeklyPlanByWeekNumber(testGoalId, 2);
      expect(week2After?.sessions.length).toBe(2);
      expect(week2After?.sessions[0].dayOfWeek).toBe('Monday');
      expect(week2After?.sessions[1].dayOfWeek).toBe('Wednesday');
      expect(week2After?.id).toBe(savedWeek2.id);

      // Verify week 3 was updated - Wednesday removed, Friday added
      expect(syncResult?.syncResult?.deletedSessionIds.length).toBe(1);
      expect(syncResult?.syncResult?.addedSessionCount).toBe(1);
    });

  });
});
