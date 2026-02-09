'use client';

import { useCallback, useState } from 'react';
import type { StreamedSkill } from '@/hooks/useSkillStream';
import { useRouter } from 'next/navigation';

import HeroSection from '@/components/LandingPage/HeroSection';
import FeaturesSection from '@/components/LandingPage/FeaturesSection';
import HowItWorksSection from '@/components/LandingPage/HowItWorksSection';
import UserCreationForm from '@/components/LandingPage/UserCreationForm';
import TopSkillsList from '@/components/LandingPage/TopSkillsList';
import BackButton from '@/components/shared/BackButton';
import Resources from '@/components/LandingPage/Resources';
import { setUserId as storeUserId, setGoalId as storeGoalId } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const [showUserCreationForm, setShowUserCreationForm] = useState(false);
  const [showTopSkills, setShowTopSkills] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [goalId, setGoalId] = useState<string>();
  const [occupation, setOccupation] = useState<string>('');
  const [goalName, setGoalName] = useState<string>('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cachedSkills, setCachedSkills] = useState<StreamedSkill[]>([]);

  const handleUserCreated = useCallback((newUserId: string, userOccupation: string) => {
    setUserId(newUserId);
    storeUserId(newUserId);
    setOccupation(userOccupation);
    setShowTopSkills(true);
    setShowUserCreationForm(false);
  }, []);

  const handleGoalCreated = useCallback((newGoalId: string, newGoalName: string) => {
    setGoalId(newGoalId);
    storeGoalId(newGoalId);
    setGoalName(newGoalName);
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
    setSelectedResourceId(null);
  }, []);

  const handleResourceSelected = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
  }, []);

  const handleResourceCommitment = useCallback(async () => {
    if (!userId || !goalId || !selectedResourceId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: selectedResourceId })
      });

      if (!response.ok) {
        throw new Error('Failed to save selected resource');
      }

      router.push(`/schedule?userId=${userId}&goalId=${goalId}`);
    } catch (error) {
      console.error('Error saving resource:', error);
    } finally {
      setIsSaving(false);
    }
  }, [userId, goalId, selectedResourceId, router]);

  if (showUserCreationForm) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-3xl mx-auto space-y-10">
          <BackButton onBack={handleBackFromUserCreationForm} />
          <UserCreationForm onUserCreated={handleUserCreated} isLoading={!!userId} />
        </div>
      </div>
    );
  }

  if (showTopSkills) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 lg:p-20">
        <div className="max-w-6xl mx-auto space-y-10">
          <BackButton onBack={handleBackFromTopSkillsForm} />
          <TopSkillsList
            userId={userId}
            occupation={occupation}
            cachedSkills={cachedSkills}
            onGoalCreated={handleGoalCreated}
            onSkillsFetched={setCachedSkills}
          />
        </div>
      </div>
    );
  }

  if (showResources && goalId) {
    return (
      <div className="max-w-6xl mx-auto py-12 md:py-16 space-y-10 px-4 md:px-6 xl:px-0">
        <BackButton onBack={handleBackFromResources} />
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight pb-2">Learning Resources</h1>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Select a resource for your <b>{goalName}</b> learning journey.
            </p>
          </div>
        </div>
        <Resources
          userId={userId!}
          goalId={goalId!}
          onResourceSelected={handleResourceSelected}
          onCommit={handleResourceCommitment}
          isSaving={isSaving}
        />
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
