'use client';

import { useCallback, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Goal } from '@/lib/mockDb';
import { Sparkle } from 'lucide-react';

interface GoalSelectionInterface {
  onGoalCreation: (goal: Goal) => void;
}

export default function GoalSelection({ onGoalCreation }: GoalSelectionInterface) {
  const [userId, setUserId] = useState();
  const [occupation, setOccupation] = useState('');
  const [skills, setSkills] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [disableSkillDefinitionForm, setDisableSkillDefinitionForm] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [isRegeneratingSkills, setIsRegeneratingSkills] = useState(false);
  const [aiGeneratedSkills, setAiGeneratedSkills] = useState<{ name: string; reasoning: string }[]>();
  const [selectedSkill, setSelectedSkill] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [, setError] = useState<string | null>(null);

  const handleProfileCreation = useCallback(async () => {
    if (userId) return;

    setDisableSkillDefinitionForm(true);
    setIsCreatingProfile(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: occupation,
          skills,
          careerGoals
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setUserId(data.user.id);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsCreatingProfile(false);
    }
  }, [careerGoals, occupation, skills, userId]);

  const handleAiGeneratedSkillSearch = useCallback(async () => {
    if (!userId) return;

    setIsSearchingSkills(true);
    try {
      const response = await fetch('/api/skills/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setAiGeneratedSkills(data.skills);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsSearchingSkills(false);
    }
  }, [userId]);

  const handleSkillRegeneration = useCallback(async () => {
    if (!userId) return;

    setSelectedSkill('');
    setIsRegeneratingSkills(true);
    try {
      const response = await fetch('/api/skills/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setAiGeneratedSkills(data.skills);
      scrollToTopSkills();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsRegeneratingSkills(false);
    }
  }, [userId]);

  useEffect(() => {
    handleAiGeneratedSkillSearch();
  }, [handleAiGeneratedSkillSearch]);

  const scrollToTopSkills = () =>
    setTimeout(() => {
      document.getElementById('top-skills')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

  const handleConfirm = useCallback(async () => {
    if (!userId || !selectedSkill || !aiGeneratedSkills) return;

    // Extract skill index from "skill-0", "skill-1", etc.
    const skillIndex = parseInt(selectedSkill.replace('skill-', ''), 10);
    const skill = aiGeneratedSkills[skillIndex];

    if (!skill) return;

    setIsConfirming(true);
    try {
      const response = await fetch('/api/goals', {
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
      onGoalCreation(data.goal);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  }, [userId, selectedSkill, aiGeneratedSkills, onGoalCreation]);

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight">Focus your ambition.</h1>
        <p className="text-xl text-muted-foreground font-medium leading-relaxed">
          Tell us about yourself and we&apos;ll identify the top skills to accelerate your career growth in 2026.
        </p>
      </div>

      <section className="space-y-3">
        <Label htmlFor="occupation" className="text-sm font-bold uppercase tracking-widest text-border">
          Your Current Occupation
        </Label>
        <Input
          id="occupation"
          type="text"
          placeholder="e.g., Software Engineer, Product Manager, Data Analyst"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          disabled={disableSkillDefinitionForm}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      <section className="space-y-3">
        <Label htmlFor="strongest-skills" className="text-sm font-bold uppercase tracking-widest text-border">
          Your Strongest Skills
        </Label>
        <Input
          id="strongest-skills"
          type="text"
          placeholder="e.g., JavaScript, Team Leadership, Data Analysis"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          disabled={disableSkillDefinitionForm}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      <section className="space-y-3">
        <Label htmlFor="career-goals" className="text-sm font-bold uppercase tracking-widest text-border">
          Your Career Goals
        </Label>
        <Input
          id="career-goals"
          type="text"
          placeholder="e.g., Transition to senior role, Lead technical projects"
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          disabled={disableSkillDefinitionForm}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </section>

      {!aiGeneratedSkills && (
        <div className="pt-6">
          <Button
            className="w-full h-20 text-xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold"
            onClick={handleProfileCreation}
            disabled={!occupation.trim() || !skills.trim() || !careerGoals.trim() || isSearchingSkills}
          >
            Search Top Skills
          </Button>
        </div>
      )}

      {isCreatingProfile && <div>Creating user profile...</div>}
      {isSearchingSkills && (
        <div className="flex flex-row p-4 bg-muted rounded-2xl">
          <Sparkle className="pr-2" /> <div className="text-xl">AI generating top skills...</div>
        </div>
      )}

      {aiGeneratedSkills && (
        <section className="space-y-8" id="top-skills">
          <div className="border-l-4 border-foreground pl-6">
            <h2 className="text-3xl xl:text-4xl font-extrabold mt-16">
              Top 10 Skills for <span className="text-accent">{occupation}</span>
            </h2>
            <p className="text-muted-foreground font-medium mt-1 xl:text-lg">Select the one skill you will master this year.</p>
          </div>

          <RadioGroup value={selectedSkill} onValueChange={setSelectedSkill} className="grid xl:grid-cols-2 grid-col-1 gap-3">
            {aiGeneratedSkills.map((skill, index) => (
              <div
                key={skill.name}
                className="flex items-start space-x-4 p-5 min-h-15 rounded-xl border-2 border-border bg-background hover:bg-muted transition-colors cursor-pointer focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2"
              >
                <RadioGroupItem
                  value={`skill-${index}`}
                  id={`skill-${index}`}
                  className="h-6 w-6 border-2 border-foreground shrink-0 mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor={`skill-${index}`} className="text-lg xl:text-xl font-bold cursor-pointer block text-foreground">
                    {skill.name}
                  </Label>
                  <p className="text-base text-muted-foreground font-medium mt-1 cursor-pointer">{skill.reasoning}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </section>
      )}

      {aiGeneratedSkills && (
        <div className="pt-6 space-y-4">
          <Button
            className="w-full h-20 text-2xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={!selectedSkill || isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? 'Creating your goal...' : 'Confirm My 2026 Goal'}
          </Button>
          <Button
            variant="ghost"
            disabled={isRegeneratingSkills}
            className="w-full h-14 text-lg font-bold min-h-11 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleSkillRegeneration}
          >
            Regenerate New Skills
          </Button>
          {isRegeneratingSkills && (
            <div className="flex flex-row p-4 bg-muted rounded-2xl">
              <Sparkle className="pr-2" /> <div className="text-xl">AI generating top skills...</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
