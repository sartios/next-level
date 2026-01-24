'use client';

import { useCallback, useEffect, useState } from 'react';

interface Goal {
  id: string;
  name: string;
  reasoning: string;
}

interface Resource {
  title: string;
  link: string;
  reasoning: string;
}

interface GoalResponse {
  goal: Goal;
}

interface GoalResourcesResponse {
  resources: Resource[];
}

interface RoadmapStep {
  step: string;
  description: string;
  resources: Resource[];
}

interface RoadmapResponse {
  roadmap: RoadmapStep[];
  extraResources: Resource[];
}

interface Props {
  params: { id: string };
}

export default function GoalResourcesPage({ params }: Props) {
  const [goal, setGoal] = useState<Goal>();
  const [resources, setResources] = useState<Resource[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([]);
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
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchGoal();
  }, [params]);

  // Fetch resources
  const fetchResources = useCallback(async () => {
    if (!goal) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/goals/${goal.id}/resources`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: GoalResourcesResponse = await response.json();
      setResources(data.resources || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  // Create roadmap based on selected resources
  const createRoadmap = useCallback(async () => {
    if (!goal || resources.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/goals/${goal.id}/roadmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedResources: resources
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
  }, [goal, resources]);

  if (!goal) return null;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Learning Resources for Goal: {goal.name}</h1>
      <h3 className="text-md text-gray-600">{goal.reasoning}</h3>

      <div className="mt-4 space-x-2">
        <button onClick={fetchResources} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          {loading ? 'Fetching Resources...' : 'Fetch Resources'}
        </button>

        <button
          onClick={createRoadmap}
          disabled={loading || resources.length === 0}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          {loading ? 'Creating Roadmap...' : 'Create Roadmap'}
        </button>
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <h2 className="mt-6 text-lg font-semibold">Resources for: {goal.name}</h2>
      <ul className="mt-2 space-y-3">
        {resources.map((res, idx) => (
          <li key={idx} className="border p-3 rounded shadow-sm">
            <a href={res.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
              {res.title}
            </a>
            <p className="text-sm mt-1">{res.reasoning}</p>
          </li>
        ))}
      </ul>

      {roadmap.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-semibold">Generated Roadmap</h2>
          <ul className="mt-2 space-y-4">
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
    </div>
  );
}
