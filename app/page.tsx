'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

import HeroSection from '@/components/LandingPage/HeroSection';
import FeaturesSection from '@/components/LandingPage/FeaturesSection';
import HowItWorksSection from '@/components/LandingPage/HowItWorksSection';
import GoalSelection from '@/components/LandingPage/GoalSelection';
import BackButton from '@/components/shared/BackButton';
import Resources from '@/components/LandingPage/Resources';
import { Goal } from '@/lib/mockDb';
import Link from 'next/link';

export default function Home() {
  const [showDefineGoalForm, setShowDefineGoalForm] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [goal, setGoal] = useState<Goal>();

  const onGoalCreation = (_goal: Goal) => {
    setGoal(_goal);
    setShowDefineGoalForm(false);
    setShowResources(true);
  };

  if (showDefineGoalForm) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-4xl mx-auto space-y-16">
          <BackButton onBack={() => setShowDefineGoalForm(false)} />
          <GoalSelection onGoalCreation={onGoalCreation} />
        </div>
      </div>
    );
  }

  if (showResources && goal) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <BackButton
          onBack={() => {
            setShowDefineGoalForm(true);
            setShowResources(false);
          }}
        />
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12 border-b border-muted pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-foreground">Learning Resources</h1>
            <p className="text-muted-foreground font-medium">Curated paths for your {goal.name} 2026 mastery.</p>
          </div>
        </div>
        <Resources goal={goal} />
        <Button
          className="w-full h-20 text-2xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          asChild
        >
          <Link href="/schedule">Create your schedule</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <HeroSection onDefineGoal={() => setShowDefineGoalForm(true)} />
      <FeaturesSection />
      <HowItWorksSection />
    </>
  );
}
