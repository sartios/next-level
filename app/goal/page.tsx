'use client';

import { useEffect, useState, useCallback } from 'react';
import ActiveRoadmap from '@/components/GoalPage/ActiveRoadmap';
import MotivationalHeader from '@/components/GoalPage/MotivationalHeader';
import { getGoalId, getUserId } from '@/lib/storage';
import type { Goal } from '@/lib/db/goalRepository';
import type { WeeklyPlanWithSessions } from '@/lib/db/weeklyPlanRepository';

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface GoalAvailability {
  weeklyHours: number;
  startDate: string;
  targetCompletionDate: string | null;
  slots: AvailabilitySlot[];
}

/** Extended Goal type with enriched data from API */
interface EnrichedGoal extends Goal {
  availability?: GoalAvailability | null;
  weeklyPlans?: WeeklyPlanWithSessions[];
  currentWeekPlan?: WeeklyPlanWithSessions | null;
}

export default function GoalPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goal, setGoal] = useState<EnrichedGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
    setGoalId(getGoalId());
  }, []);

  const fetchGoal = useCallback(async () => {
    if (!userId || !goalId) return;

    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setGoal(data.goal);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, goalId]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 md:py-16">
      <MotivationalHeader />

      {loading && (
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-16">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}

      <div>
        <ActiveRoadmap goal={goal} onSessionUpdate={fetchGoal} />
      </div>
    </div>
  );
}
