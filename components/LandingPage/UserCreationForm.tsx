'use client';

import { useCallback, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UserCreationFormProps {
  onUserCreated: (userId: string, occupation: string) => void;
  isLoading?: boolean;
}

export default function UserCreationForm({ onUserCreated, isLoading = false }: UserCreationFormProps) {
  const [occupation, setOccupation] = useState('');
  const [userSkills, setUserSkills] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleProfileCreation = useCallback(async () => {
    if (isSubmitted) return;

    setIsCreatingUser(true);
    setError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: occupation,
          skills: userSkills,
          careerGoals
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setIsSubmitted(true);
      onUserCreated(data.user.id, occupation);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsCreatingUser(false);
    }
  }, [careerGoals, occupation, userSkills, isSubmitted, onUserCreated]);

  const isFormDisabled = isSubmitted || isCreatingUser;

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight">Focus your ambition.</h1>
        <p className="text-xl text-muted-foreground font-medium leading-relaxed">
          Tell us about yourself and we&apos;ll identify the top skills to accelerate your career growth in 2026.
        </p>
      </div>

      <section className="space-y-3">
        <Label htmlFor="occupation" className="text-sm text-foreground font-bold uppercase tracking-widest">
          Your Current Occupation
        </Label>
        <Input
          id="occupation"
          type="text"
          placeholder={isMobile ? 'e.g., Software Engineer' : 'e.g., Software Engineer, Product Manager, Data Analyst'}
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          disabled={isFormDisabled}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      <section className="space-y-3">
        <Label htmlFor="strongest-skills" className="text-sm font-bold uppercase tracking-widest text-foreground">
          Your Strongest Skills
        </Label>
        <Input
          id="strongest-skills"
          type="text"
          placeholder={isMobile ? 'e.g., JavaScript, Leadership' : 'e.g., JavaScript, Team Leadership, Data Analysis'}
          value={userSkills}
          onChange={(e) => setUserSkills(e.target.value)}
          disabled={isFormDisabled}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      <section className="space-y-3">
        <Label htmlFor="career-goals" className="text-sm font-bold uppercase tracking-widest text-foreground">
          Your Career Goals
        </Label>
        <Input
          id="career-goals"
          type="text"
          placeholder={isMobile ? 'e.g., Senior role, Lead projects' : 'e.g., Transition to senior role, Lead technical projects'}
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          disabled={isFormDisabled}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      {error && <div className="p-4 bg-red-100 text-red-800 rounded-2xl">{error}</div>}

      {!isSubmitted && !isLoading && (
        <div className="pt-6">
          <Button
            className="w-full min-h-14 text-base xl:text-lg bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium"
            onClick={handleProfileCreation}
            disabled={!occupation.trim() || !userSkills.trim() || !careerGoals.trim() || isCreatingUser}
          >
            {isCreatingUser ? 'Creating profile...' : 'Search Top Skills'}
          </Button>
        </div>
      )}
    </>
  );
}
