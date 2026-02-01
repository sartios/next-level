'use client';

import { useEffect, useState } from 'react';
import ActiveRoadmap from '@/components/GoalPage/ActiveRoadmap';
import MotivationalHeader from '@/components/GoalPage/MotivationalHeader';
import { Goal } from '@/lib/mockDb';

export default function GoalPage() {
  const userId = '123';
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const response = await fetch(`/api/users/${userId}/goal`);

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
    };

    fetchGoal();
  }, []);

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
        <ActiveRoadmap goal={goal} />
      </div>
    </div>
  );
}
