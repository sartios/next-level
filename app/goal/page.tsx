'use client';

import { useEffect, useState, useCallback } from 'react';
import ActiveRoadmap from '@/components/GoalPage/ActiveRoadmap';
import { getGoalId, getUserId } from '@/lib/storage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Target } from 'lucide-react';
import Link from 'next/link';
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
    if (!userId || !goalId) {
      setLoading(false);
      return;
    }

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

  const renderContent = () => {
    if (error) {
      return <p className="text-red-500 px-4 xl:px-0">{error}</p>;
    }

    if (loading) {
      return (
        <Card className="p-8 text-center border-2 border-muted shadow-none mx-4 xl:mx-0 h-120 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 mx-auto text-accent mb-4 animate-spin" />
          <h3 className="text-2xl xl:text-3xl font-bold text-foreground">Loading your roadmap...</h3>
          <p className="xl:text-xl text-muted-foreground">Please wait while we fetch your progress</p>
        </Card>
      );
    }

    if (!goalId) {
      return (
        <Card className="p-8 text-center border-2 border-muted shadow-none mx-4 xl:mx-0 h-120 flex flex-col items-center justify-center">
          <Target className="h-12 w-12 mx-auto text-accent mb-4" />
          <h3 className="text-2xl xl:text-3xl font-bold text-foreground">Start your journey by setting your first goal</h3>
          <p className="xl:text-xl text-muted-foreground mb-4">
            Define your career aspirations and we&apos;ll create a personalized learning roadmap to help you achieve them.
          </p>
          <Button
            asChild
            className="w-full lg:w-1/3 h-16 text-xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold mx-auto"
          >
            <Link href="/">Define your goal</Link>
          </Button>
        </Card>
      );
    }

    return <ActiveRoadmap goal={goal} onSessionUpdate={fetchGoal} />;
  };

  return (
    <div className="max-w-6xl mx-auto py-10 xl:py-12">
      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-11 px-4 xl:px-0">This week&apos;s Plan</h1>
      {renderContent()}
    </div>
  );
}
