'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SuggestedSkill {
  name: string;
  reasoning: string;
  priority: number;
}

const getPriorityLabel = (priority: number): { label: string; style: string } => {
  if (priority <= 3) return { label: 'High', style: 'bg-red-100 text-red-800' };
  if (priority <= 6) return { label: 'Medium', style: 'bg-yellow-100 text-yellow-800' };
  return { label: 'Low', style: 'bg-green-100 text-green-800' };
};

export default function SkillSelectPage() {
  const router = useRouter();
  const userId = '123';
  const [skills, setSkills] = useState<SuggestedSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SuggestedSkill | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('/api/skills/suggested');

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        setSkills(data.skills || []);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, []);

  const handleSelectSkill = (skill: SuggestedSkill) => {
    setSelectedSkill(skill);
  };

  const handleContinue = async () => {
    if (!selectedSkill || !userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name: selectedSkill.name,
          reasoning: selectedSkill.reasoning
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      router.push(`/goals/${data.goal.id}?userId=${userId}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading your personalized skill suggestions...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-bold text-center mb-4">Choose Your Next Skill</h1>
        <p className="text-center text-gray-600 mb-8">Based on your profile, we&apos;ve identified skills that will advance your career.</p>

        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

        <div className="space-y-4 mb-6">
          {skills.map((skillItem, idx) => {
            const priorityInfo = getPriorityLabel(skillItem.priority);
            const isSelected = selectedSkill?.name === skillItem.name;
            return (
              <div
                key={idx}
                onClick={() => handleSelectSkill(skillItem)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-black">{skillItem.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${priorityInfo.style}`}>{priorityInfo.label} Priority</span>
                    </div>
                    <p className="text-gray-700 text-sm">{skillItem.reasoning}</p>
                  </div>
                  {isSelected && (
                    <div className="ml-4">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selectedSkill || submitting}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating Goal...' : `Continue with ${selectedSkill?.name || 'Selected Skill'}`}
        </button>
      </div>
    </div>
  );
}
