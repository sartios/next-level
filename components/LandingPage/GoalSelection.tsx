'use client';

import { useCallback, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function GoalSelection() {
  const [userId, setUserId] = useState();
  const [name, setName] = useState('Alice Johnson');
  const [occupation, setOccupation] = useState('Software Engineer');
  const [skills, setSkills] = useState('JavaScript, React, Node.js');
  const [careerGoals, setCareerGoals] = useState('Team lead role, Learn AI/ML');
  const [disableSkillDefinitionForm, setDisableSkillDefinitionForm] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [isRegeneratingSkills, setIsRegeneratingSkills] = useState(false);
  const [aiGeneratedSkills, setAiGeneratedSkills] = useState<{ name: string; reasoning: string }[]>();
  const [selectedSkill, setSelectedSkill] = useState('');
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
          name,
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
  }, [careerGoals, name, occupation, skills, userId]);

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

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight">Focus your ambition.</h1>
        <p className="text-xl text-muted-foreground font-medium max-w-2xl leading-relaxed">
          Tell us about yourself and we&apos;ll identify the top skills to accelerate your career growth in 2026.
        </p>
      </div>

      <section className="space-y-3">
        <Label htmlFor="occupation" className="text-sm font-bold uppercase tracking-widest text-border">
          Your Name
        </Label>
        <Input
          id="occupation"
          type="text"
          placeholder="e.g., Alice Cooper"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disableSkillDefinitionForm}
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </section>

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
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          className="w-full h-14 border-2 border-border bg-background font-medium text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </section>

      {!aiGeneratedSkills && (
        <div className="pt-6">
          <Button
            className="w-full h-16 text-xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 font-bold"
            onClick={handleProfileCreation}
            disabled={!name.trim() || !occupation.trim() || !skills.trim() || !careerGoals.trim() || isSearchingSkills}
          >
            Search Top Skills
          </Button>
        </div>
      )}

      {isCreatingProfile && <div>Creating user profile...</div>}
      {isSearchingSkills && <div>AI generating top skills...</div>}

      {aiGeneratedSkills && (
        <section className="space-y-8" id="top-skills">
          <div className="border-l-4 border-foreground pl-6">
            <h2 className="text-3xl font-extrabold">Top 10 Skills for {occupation}</h2>
            <p className="text-muted-foreground font-medium mt-1">Select the one skill you will master this year.</p>
          </div>

          <RadioGroup value={selectedSkill} onValueChange={setSelectedSkill} className="grid grid-cols-1 gap-3">
            {aiGeneratedSkills.map((skill, index) => (
              <div
                key={skill.name}
                className="flex items-start space-x-4 p-5 min-h-15 rounded-xl border-2 border-border bg-background hover:bg-muted transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              >
                <RadioGroupItem
                  value={`skill-${index}`}
                  id={`skill-${index}`}
                  className="h-6 w-6 border-2 border-foreground shrink-0 mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor={`skill-${index}`} className="text-lg font-bold cursor-pointer block text-foreground">
                    {skill.name}
                  </Label>
                  <p className="text-sm text-muted-foreground font-medium mt-1 cursor-pointer">{skill.reasoning}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </section>
      )}

      {aiGeneratedSkills && (
        <div className="pt-10 space-y-4">
          <Button
            className="w-full h-20 text-2xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            disabled={!selectedSkill}
            // onClick={handleConfirm}
          >
            Confirm My 2026 Goal
          </Button>
          <Button
            variant="ghost"
            disabled={isRegeneratingSkills}
            className="w-full h-14 text-lg font-bold min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleSkillRegeneration}
          >
            Regenerate New Skills
          </Button>
          {isRegeneratingSkills && <div>AI regenerating top skills...</div>}
        </div>
      )}
    </>
  );
}
