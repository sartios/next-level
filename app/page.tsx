'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';

import HeroSection from '@/components/LandingPage/HeroSection';
import FeaturesSection from '@/components/LandingPage/FeaturesSection';
import HowItWorksSection from '@/components/LandingPage/HowItWorksSection';
import UserCreationForm from '@/components/LandingPage/UserCreationForm';
import TopSkillsList from '@/components/LandingPage/TopSkillsList';
import BackButton from '@/components/shared/BackButton';
import Resources from '@/components/LandingPage/Resources';
import Link from 'next/link';

export default function Home() {
  const [showUserCreationForm, setShowUserCreationForm] = useState(false);
  const [showTopSkills, setShowTopSkills] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [goalId, setGoalId] = useState<string>();
  const [occupation, setOccupation] = useState<string>('');
  const [goalName, setGoalName] = useState<string>('');

  const handleUserCreated = useCallback((newUserId: string, userOccupation: string) => {
    setUserId(newUserId);
    setOccupation(userOccupation);
    setShowTopSkills(true);
    setShowUserCreationForm(false);
  }, []);

  const handleGoalCreated = useCallback((newGoalId: string, goalName: string) => {
    setGoalId(newGoalId);
    setGoalName(goalName);
    setShowTopSkills(false);
    setShowUserCreationForm(false);
    setShowResources(true);
  }, []);

  const handleBackFromUserCreationForm = useCallback(() => {
    setShowUserCreationForm(false);
  }, []);

  const handleBackFromTopSkillsForm = useCallback(() => {
    setShowUserCreationForm(true);
    setShowTopSkills(false);
  }, []);

  const handleBackFromResources = useCallback(() => {
    setShowUserCreationForm(false);
    setShowResources(false);
    setShowTopSkills(true);
  }, []);

  if (showUserCreationForm) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <BackButton onBack={handleBackFromUserCreationForm} />
          <UserCreationForm onUserCreated={handleUserCreated} isLoading={!!userId} />
        </div>
      </div>
    );
  }

  if (showTopSkills) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <BackButton onBack={handleBackFromTopSkillsForm} />
          <TopSkillsList userId={userId} occupation={occupation} onGoalCreated={handleGoalCreated} />
        </div>
      </div>
    );
  }

  if (showResources && goalId) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-10">
        <BackButton onBack={handleBackFromResources} />
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight pb-2">Learning Resources</h1>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Curated paths for your <b>{goalName}</b> 2026 mastery.
            </p>
          </div>
        </div>
        <Resources userId={userId!} goalId={goalId!} />
        <Button
          className="w-full h-20 text-2xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2"
          asChild
        >
          <Link href="/schedule">Create your schedule</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <HeroSection onDefineGoal={() => setShowUserCreationForm(true)} />
      <FeaturesSection />
      <HowItWorksSection />
    </>
  );
}
