'use client';

import { useState } from 'react';

import HeroSection from '@/components/LandingPage/HeroSection';
import FeaturesSection from '@/components/LandingPage/FeaturesSection';
import HowItWorksSection from '@/components/LandingPage/HowItWorksSection';
import GoalSelection from '@/components/LandingPage/GoalSelection';
import BackButton from '@/components/shared/BackButton';

export default function Home() {
  const [showDefineGoalForm, setShowDefineGoalForm] = useState(false);

  if (showDefineGoalForm) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-4xl mx-auto space-y-16">
          <BackButton onBack={() => setShowDefineGoalForm(false)} />
          <GoalSelection />
        </div>
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
