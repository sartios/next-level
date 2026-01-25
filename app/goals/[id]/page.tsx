'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Resource {
  title: string;
  link: string;
  reasoning: string;
}

interface RoadmapStep {
  step: string;
  description: string;
  resources: Resource[];
}

interface LearningSession {
  day: string;
  startTime: string;
  endTime: string;
  roadmapStep: string;
  activities: string[];
  durationMinutes: number;
}

interface WeeklyPlan {
  weekNumber: number;
  weekStartDate: string;
  focusArea: string;
  sessions: LearningSession[];
  totalMinutes: number;
  completionPercentage: number;
}

interface MultiWeekPlan {
  totalWeeks: number;
  estimatedCompletionDate: string;
  weeks: WeeklyPlan[];
}

interface Goal {
  id: string;
  name: string;
  reasoning: string;
  resources: Resource[];
  roadmap: RoadmapStep[];
  plan: MultiWeekPlan | null;
}

interface GoalResponse {
  goal: Goal;
}

interface RoadmapResponse {
  roadmap: RoadmapStep[];
  extraResources: Resource[];
}

interface Props {
  params: { id: string };
}

export default function GoalResourcesPage({ params }: Props) {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const [goal, setGoal] = useState<Goal>();
  const [resources, setResources] = useState<Resource[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([]);
  const [multiWeekPlan, setMultiWeekPlan] = useState<MultiWeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch goal info
  useEffect(() => {
    const fetchGoal = async () => {
      setLoading(true);
      setError(null);

      try {
        const { id: goalId } = await params;
        const response = await fetch(`/api/goals/${goalId}`);

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data: GoalResponse = await response.json();
        setGoal(data.goal);
        // Set resources from the goal (populated during goal creation)
        if (data.goal.resources && data.goal.resources.length > 0) {
          setResources(data.goal.resources);
        }
        // Set roadmap from the goal if it exists
        if (data.goal.roadmap && data.goal.roadmap.length > 0) {
          setRoadmap(data.goal.roadmap);
        }
        // Set plan from the goal if it exists
        if (data.goal.plan) {
          setMultiWeekPlan(data.goal.plan);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchGoal();
  }, [params]);

  const createRoadmap = useCallback(async () => {
    if (!goal || resources.length === 0) return;

    if (!userId) {
      setError('User ID not found. Please start from the beginning.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/goals/${goal.id}/roadmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedResources: resources,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: RoadmapResponse = await response.json();
      setRoadmap(data.roadmap || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [goal, resources, userId]);

  const acceptRoadmap = useCallback(async () => {
    if (!goal || roadmap.length === 0) return;

    if (!userId) {
      setError('User ID not found. Please start from the beginning.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/goals/${goal.id}/roadmap/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roadmap,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setMultiWeekPlan(data.multiWeekPlan);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [goal, roadmap, userId]);

  if (!goal) return null;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Learning Resources for Goal: {goal.name}</h1>
      <h3 className="text-md text-gray-600">{goal.reasoning}</h3>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <h2 className="mt-6 text-lg font-semibold">Resources for: {goal.name}</h2>
      {resources.length > 0 ? (
        <ul className="mt-2 space-y-3">
          {resources.map((res, idx) => (
            <li key={idx} className="border p-3 rounded shadow-sm bg-white">
              <a href={res.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
                {res.title}
              </a>
              <p className="text-sm text-gray-600 mt-1">{res.reasoning}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-gray-500">No resources available yet.</p>
      )}

      {resources.length > 0 && roadmap.length === 0 && !multiWeekPlan && (
        <div className="mt-6">
          <button
            onClick={createRoadmap}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Creating Roadmap...' : 'Create Roadmap'}
          </button>
        </div>
      )}

      {roadmap.length > 0 && !multiWeekPlan && (
        <>
          <h2 className="mt-6 text-lg font-semibold">Generated Roadmap</h2>
          <div className="mt-4">
            <button
              onClick={acceptRoadmap}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Accepting...' : 'Accept Roadmap'}
            </button>
          </div>
          <ul className="mt-4 space-y-4">
            {roadmap.map((step, idx) => (
              <li key={idx} className="border p-3 rounded shadow-sm">
                <h3 className="font-semibold">{step.step}</h3>
                <p className="text-sm mt-1">{step.description}</p>
                <ul className="mt-2 pl-4 space-y-2">
                  {step.resources.map((res, rIdx) => (
                    <li key={rIdx}>
                      <a href={res.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {res.title}
                      </a>{' '}
                      - <span className="text-sm">{res.reasoning}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {multiWeekPlan && (
        <>
          <div className="mt-6 p-4 bg-green-100 border border-green-400 rounded">
            <h2 className="text-xl font-bold text-green-800">✓ Roadmap Accepted!</h2>
            <p className="text-green-700 mt-2">
              Your {multiWeekPlan.totalWeeks}-week learning plan is ready. Estimated completion:{' '}
              {new Date(multiWeekPlan.estimatedCompletionDate).toLocaleDateString()}
            </p>
          </div>

          <h2 className="mt-6 text-xl font-bold">Your Multi-Week Learning Plan</h2>
          <div className="mt-4 space-y-6">
            {multiWeekPlan.weeks.map((week, idx) => (
              <div key={idx} className="border-2 border-blue-200 p-4 rounded-lg bg-blue-50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-blue-900">
                    Week {week.weekNumber} - {week.focusArea}
                  </h3>
                  <span className="text-sm font-semibold text-blue-700">{week.completionPercentage}% Complete</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Starts: {new Date(week.weekStartDate).toLocaleDateString()} | Total: {week.totalMinutes} minutes
                </p>
                <div className="space-y-3">
                  {week.sessions.map((session, sIdx) => (
                    <div key={sIdx} className="bg-white p-3 rounded border border-blue-300">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-blue-800">{session.day}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {session.startTime} - {session.endTime} ({session.durationMinutes} min)
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-2">📚 {session.roadmapStep}</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {session.activities.map((activity, aIdx) => (
                          <li key={aIdx}>{activity}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
