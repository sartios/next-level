'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSkillStream, StreamedSkill } from '@/hooks/useSkillStream';
import { SKILLS_PER_USER } from '@/lib/prompts/agentPrompts';

function SkillCardSkeleton() {
  return (
    <div className="p-5 min-h-15 rounded-xl border-2 border-border bg-background">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

function TopSkillsListSkeleton({ occupation }: { occupation: string }) {
  return (
    <section className="space-y-8" id="top-skills">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight">
          Top Skills for <span className="text-accent">{occupation}</span>
        </h1>
        <p className="text-xl text-muted-foreground font-medium leading-relaxed">AI is generating skills to master</p>
      </div>

      <div className="grid xl:grid-cols-2 grid-col-1 gap-3">
        {Array.from({ length: SKILLS_PER_USER }).map((_, index) => (
          <SkillCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

interface TopSkillsListProps {
  userId: string | undefined;
  occupation: string;
  onGoalCreated: (goalId: string, goalName: string) => void;
}

export default function TopSkillsList({ userId, occupation, onGoalCreated }: TopSkillsListProps) {
  const [selectedSkill, setSelectedSkill] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skillStream = useSkillStream({
    onError: (err) => {
      setError(err.message);
    }
  });

  // Start fetching skills when userId is available
  useEffect(() => {
    if (userId && skillStream.skills.length === 0 && !skillStream.isLoading) {
      skillStream.submit(userId);
    }
  }, [userId, skillStream]);

  const handleRegenerate = useCallback(() => {
    if (!userId) return;
    setSelectedSkill('');
    setError(null);
    skillStream.submit(userId);
    setTimeout(() => {
      document.getElementById('top-skills')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [userId, skillStream]);

  const handleConfirm = useCallback(async () => {
    if (!userId || !selectedSkill || skillStream.skills.length === 0) return;

    const skillIndex = parseInt(selectedSkill.replace('skill-', ''), 10);
    const skill = skillStream.skills[skillIndex];

    if (!skill) return;

    setIsConfirming(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name: skill.name,
          reasoning: skill.reasoning
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      onGoalCreated(data.goal.id, data.goal.name);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  }, [userId, selectedSkill, skillStream.skills, onGoalCreated]);

  const hasSkills = skillStream.skills.length > 0;

  // Show skeleton while loading and no skills yet
  if (!hasSkills && skillStream.isLoading) {
    return <TopSkillsListSkeleton occupation={occupation} />;
  }

  // Don't render anything if no userId or no skills yet
  if (!userId || !hasSkills) {
    return null;
  }

  return (
    <>
      {skillStream.error && <div className="p-4 bg-red-100 text-red-800 rounded-2xl">{skillStream.error.message}</div>}

      <section className="space-y-8" id="top-skills">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            The Top Skills for <span className="text-accent">{occupation}</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium leading-relaxed">Select the one skill you will master this year.</p>
        </div>
        <div className="border-l-4 border-foreground pl-6">
          {skillStream.isLoading && <span className="text-muted-foreground text-lg ml-2">({skillStream.skills.length} found...)</span>}
        </div>

        <div className="grid xl:grid-cols-2 grid-col-1 gap-3">
          {skillStream.skills.map((skill: StreamedSkill, index: number) => {
            const skillId = `skill-${index}`;
            const isSelected = selectedSkill === skillId;
            return (
              <div
                key={`${skill.name}-${index}`}
                onClick={() => setSelectedSkill(skillId)}
                className={`flex flex-col p-5 min-h-15 rounded-xl border-2 bg-background transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  isSelected ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/50 shadow-sm'
                }`}
              >
                <div>
                  <h3 className="text-lg xl:text-xl font-bold text-foreground">{skill.name}</h3>
                  <p className="text-base text-muted-foreground font-medium mt-1">{skill.reasoning}</p>
                </div>
                {isSelected && !skillStream.isLoading && (
                  <Button
                    className="w-full min-h-14 mt-4 text-base xl:text-lg bg-foreground text-background hover:opacity-90 rounded-xl shadow-md"
                    disabled={isConfirming}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirm();
                    }}
                  >
                    {isConfirming ? 'Creating your goal...' : 'Confirm Selection'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="p-4 bg-red-100 text-red-800 rounded-2xl">{error}</div>}
      </section>

      {!skillStream.isLoading && (
        <div className="pt-6">
          <Button
            variant="ghost"
            className="w-full min-h-14 text-base xl:text-lg font-medium rounded-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleRegenerate}
          >
            Regenerate New Skills
          </Button>
        </div>
      )}
    </>
  );
}
