import { describe, it, expect } from 'vitest';
import {
  generateSingleWeekPlan,
  generateSessionsForNewSlots,
  scheduleToAvailabilitySlots,
  getCurrentWeekNumber,
  getWeekStartDate,
  type AvailabilitySlot,
  type GenerateSingleWeekInput,
  type GenerateSessionsForNewSlotsInput
} from '../../lib/utils/createWeeklyPlan';
import type { LearningResourceWithSections } from '../../lib/types';
import type { PlanSession } from '../../lib/db/weeklyPlanRepository';

describe('createWeeklyPlan utility functions', () => {
  const mockResource = {
    id: 'resource-1',
    url: 'https://example.com/course',
    title: 'Test Course',
    description: 'A test course',
    provider: 'test-provider',
    resourceType: 'course',
    learningObjectives: ['Learn testing'],
    targetAudience: ['Developers'],
    totalHours: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections: [
      {
        id: 'section-1',
        resourceId: 'resource-1',
        title: 'Introduction',
        estimatedMinutes: 30,
        orderIndex: 0,
        topics: ['Overview', 'Setup']
      },
      {
        id: 'section-2',
        resourceId: 'resource-1',
        title: 'Core Concepts',
        estimatedMinutes: 60,
        orderIndex: 1,
        topics: ['Concept 1', 'Concept 2', 'Concept 3']
      },
      {
        id: 'section-3',
        resourceId: 'resource-1',
        title: 'Advanced Topics',
        estimatedMinutes: 45,
        orderIndex: 2,
        topics: ['Advanced 1', 'Advanced 2']
      }
    ]
  } as LearningResourceWithSections;

  const mockAvailabilitySlots: AvailabilitySlot[] = [
    { day: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
    { day: 'Wednesday', startTime: '14:00', endTime: '14:30', durationMinutes: 30 },
    { day: 'Friday', startTime: '10:00', endTime: '10:30', durationMinutes: 30 }
  ];

  describe('generateSingleWeekPlan', () => {
    it('should generate a plan with sessions for available slots', () => {
      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: mockAvailabilitySlots,
        resource: mockResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      expect(result.plan.goalId).toBe('goal-1');
      expect(result.plan.weekNumber).toBe(1);
      expect(result.sessions).toHaveLength(3);
      expect(result.plan.totalMinutes).toBe(90);
    });

    it('should prioritize incomplete sessions from previous week', () => {
      const incompleteSession: PlanSession = {
        id: 'old-session-1',
        weeklyPlanId: 'old-plan',
        dayOfWeek: 'Tuesday',
        startTime: '10:00',
        endTime: '10:30',
        durationMinutes: 30,
        topic: 'Carried Over Topic',
        activities: ['Incomplete activity'],
        status: 'pending',
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 2,
        weekStartDate: new Date('2024-01-08'),
        availabilitySlots: mockAvailabilitySlots,
        resource: mockResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: [incompleteSession]
      };

      const result = generateSingleWeekPlan(input);

      // First session should be the carried over one
      expect(result.sessions[0].topic).toBe('Carried Over Topic');
      expect(result.sessions[0].activities).toEqual(['Incomplete activity']);
      // Remaining slots get new sections
      expect(result.sessions).toHaveLength(3);
    });

    it('should skip completed sections', () => {
      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: mockAvailabilitySlots,
        resource: mockResource,
        completedSectionTitles: ['Introduction'],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      // Should start with Core Concepts, not Introduction
      const topics = result.sessions.map((s) => s.topic);
      expect(topics).not.toContain('Introduction');
      expect(topics).toContain('Core Concepts');
    });

    it('should sort slots by day of week and time', () => {
      const unsortedSlots: AvailabilitySlot[] = [
        { day: 'Friday', startTime: '10:00', endTime: '10:30', durationMinutes: 30 },
        { day: 'Monday', startTime: '14:00', endTime: '14:30', durationMinutes: 30 },
        { day: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
        { day: 'Wednesday', startTime: '11:00', endTime: '11:30', durationMinutes: 30 }
      ];

      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: unsortedSlots,
        resource: mockResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      // Sessions should be in day order: Monday, Monday, Wednesday, Friday
      expect(result.sessions[0].dayOfWeek).toBe('Monday');
      expect(result.sessions[0].startTime).toBe('09:00');
      expect(result.sessions[1].dayOfWeek).toBe('Monday');
      expect(result.sessions[1].startTime).toBe('14:00');
      expect(result.sessions[2].dayOfWeek).toBe('Wednesday');
      expect(result.sessions[3].dayOfWeek).toBe('Friday');
    });

    it('should handle empty availability slots', () => {
      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: [],
        resource: mockResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      expect(result.sessions).toHaveLength(0);
      expect(result.plan.totalMinutes).toBe(0);
      expect(result.plan.focusArea).toBe('Getting Started');
    });

    it('should handle resource with no sections', () => {
      const emptyResource: LearningResourceWithSections = {
        ...mockResource,
        sections: []
      };

      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: mockAvailabilitySlots,
        resource: emptyResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      // No sessions created since there are no sections
      expect(result.sessions).toHaveLength(0);
    });

    it('should include activities from section topics', () => {
      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: [mockAvailabilitySlots[0]],
        resource: mockResource,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      // First section has topics: ['Overview', 'Setup']
      expect(result.sessions[0].activities).toEqual(['Overview', 'Setup']);
    });

    it('should use fallback activity when section has no topics', () => {
      const resourceWithNoTopics = {
        ...mockResource,
        sections: [
          {
            id: 'section-no-topics',
            resourceId: 'resource-1',
            title: 'Section Without Topics',
            estimatedMinutes: 30,
            orderIndex: 0,
            topics: []
          }
        ]
      } as LearningResourceWithSections;

      const input: GenerateSingleWeekInput = {
        goalId: 'goal-1',
        weekNumber: 1,
        weekStartDate: new Date('2024-01-01'),
        availabilitySlots: [mockAvailabilitySlots[0]],
        resource: resourceWithNoTopics,
        completedSectionTitles: [],
        incompleteSessionsFromPreviousWeek: []
      };

      const result = generateSingleWeekPlan(input);

      expect(result.sessions[0].activities).toEqual(['Study Section Without Topics']);
    });
  });

  describe('scheduleToAvailabilitySlots', () => {
    it('should convert schedule slots to availability format', () => {
      const scheduleSlots = [
        { id: '1', scheduleId: 's1', dayOfWeek: 'Monday' as const, startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
        { id: '2', scheduleId: 's1', dayOfWeek: 'Tuesday' as const, startTime: '10:00', endTime: '11:00', durationMinutes: 60 }
      ];

      const result = scheduleToAvailabilitySlots(scheduleSlots);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        day: 'Monday',
        startTime: '09:00',
        endTime: '09:30',
        durationMinutes: 30
      });
      expect(result[1]).toEqual({
        day: 'Tuesday',
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60
      });
    });
  });

  describe('getCurrentWeekNumber', () => {
    it('should return 1 for current date as start date', () => {
      const today = new Date();
      const result = getCurrentWeekNumber(today);

      expect(result).toBe(1);
    });

    it('should return 2 for date 7 days ago', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = getCurrentWeekNumber(sevenDaysAgo);

      expect(result).toBe(2);
    });

    it('should return 1 for future start date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const result = getCurrentWeekNumber(futureDate);

      expect(result).toBe(1);
    });
  });

  describe('getWeekStartDate', () => {
    it('should return same date for week 1', () => {
      const startDate = new Date('2024-01-01');
      const result = getWeekStartDate(startDate, 1);

      expect(result.toISOString().split('T')[0]).toBe('2024-01-01');
    });

    it('should return date 7 days later for week 2', () => {
      const startDate = new Date('2024-01-01');
      const result = getWeekStartDate(startDate, 2);

      expect(result.toISOString().split('T')[0]).toBe('2024-01-08');
    });

    it('should return date 14 days later for week 3', () => {
      const startDate = new Date('2024-01-01');
      const result = getWeekStartDate(startDate, 3);

      expect(result.toISOString().split('T')[0]).toBe('2024-01-15');
    });
  });

  describe('generateSessionsForNewSlots', () => {
    it('should generate sessions for new slots', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '14:30', durationMinutes: 30 }
        ],
        resource: mockResource,
        completedSectionTitles: [],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].topic).toBe('Introduction');
      expect(result.assignedSections).toContain('Introduction');
    });

    it('should skip completed sections', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }],
        resource: mockResource,
        completedSectionTitles: ['Introduction'],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].topic).toBe('Core Concepts');
    });

    it('should continue from where existing sessions left off', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }],
        resource: mockResource,
        completedSectionTitles: [],
        // Introduction section (30 min) is fully covered by existing sessions
        allExistingSessions: [{ topic: 'Introduction', durationMinutes: 30 }]
      };

      const result = generateSessionsForNewSlots(input);

      // Should start with Core Concepts since Introduction is fully covered
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].topic).toBe('Core Concepts');
    });

    it('should distribute slots across multiple sections based on duration', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
          { dayOfWeek: 'Tuesday', startTime: '10:00', endTime: '10:30', durationMinutes: 30 },
          { dayOfWeek: 'Wednesday', startTime: '11:00', endTime: '11:30', durationMinutes: 30 },
          { dayOfWeek: 'Thursday', startTime: '12:00', endTime: '12:30', durationMinutes: 30 }
        ],
        resource: mockResource,
        completedSectionTitles: [],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      // Introduction (30 min) should take 1 slot, then Core Concepts (60 min) should take 2 slots
      expect(result.sessions).toHaveLength(4);
      expect(result.sessions[0].topic).toBe('Introduction');
      expect(result.sessions[1].topic).toBe('Core Concepts');
      expect(result.sessions[2].topic).toBe('Core Concepts');
      expect(result.sessions[3].topic).toBe('Advanced Topics');
    });

    it('should continue section that has partial time spent', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }],
        resource: mockResource,
        completedSectionTitles: [],
        // Core Concepts (60 min) has 30 min already spent
        allExistingSessions: [
          { topic: 'Introduction', durationMinutes: 30 },
          { topic: 'Core Concepts', durationMinutes: 30 }
        ]
      };

      const result = generateSessionsForNewSlots(input);

      // Should continue with Core Concepts (30 min remaining)
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].topic).toBe('Core Concepts');
    });

    it('should return empty when no available sections', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }],
        resource: mockResource,
        completedSectionTitles: ['Introduction', 'Core Concepts', 'Advanced Topics'],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      expect(result.sessions).toHaveLength(0);
      expect(result.assignedSections).toHaveLength(0);
    });

    it('should return empty when no new slots', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [],
        resource: mockResource,
        completedSectionTitles: [],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      expect(result.sessions).toHaveLength(0);
    });

    it('should sort slots by day and time before assigning', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [
          { dayOfWeek: 'Wednesday', startTime: '14:00', endTime: '14:30', durationMinutes: 30 },
          { dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }
        ],
        resource: mockResource,
        completedSectionTitles: [],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      // First session should be Monday (sorted)
      expect(result.sessions[0].dayOfWeek).toBe('Monday');
      expect(result.sessions[1].dayOfWeek).toBe('Wednesday');
    });

    it('should include activities from section topics', () => {
      const input: GenerateSessionsForNewSlotsInput = {
        newSlots: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '09:30', durationMinutes: 30 }],
        resource: mockResource,
        completedSectionTitles: [],
        allExistingSessions: []
      };

      const result = generateSessionsForNewSlots(input);

      // Introduction section has topics: ['Overview', 'Setup']
      expect(result.sessions[0].activities).toEqual(['Overview', 'Setup']);
    });
  });
});
