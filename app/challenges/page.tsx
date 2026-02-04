'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGoalId, getUserId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, ArrowRight, Sparkles, CheckCircle2, XCircle, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';

interface Challenge {
  id: string;
  goalId: string;
  sectionId: string;
  sectionTitle: string;
  sectionTopics: string[] | null;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'locked' | 'pending' | 'generating' | 'complete' | 'failed';
  totalQuestions: number;
  errorMessage: string | null;
}

interface ChallengeStats {
  total: number;
  locked: number;
  pending: number;
  generating: number;
  complete: number;
  failed: number;
}

interface ResourceInfo {
  id: string;
  title: string;
  provider: string;
  resourceType: string;
}

interface ChallengeProgressInfo {
  hasProgress: boolean;
  answeredCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    color: 'bg-green-100 text-green-700 border-green-200',
    iconColor: 'text-green-600',
    points: 50,
    time: '15 min'
  },
  medium: {
    label: 'Medium',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    iconColor: 'text-orange-600',
    points: 100,
    time: '25 min'
  },
  hard: {
    label: 'Hard',
    color: 'bg-red-100 text-red-700 border-red-200',
    iconColor: 'text-red-600',
    points: 200,
    time: '45 min'
  }
};

interface SectionGroup {
  sectionId: string;
  sectionTitle: string;
  challenges: Challenge[];
}

const STATUS_CONFIG = {
  locked: {
    label: 'Locked',
    icon: Lock,
    color: 'text-muted-foreground',
    animate: false
  },
  pending: {
    label: 'Pending',
    icon: Sparkles,
    color: 'text-muted-foreground',
    animate: false
  },
  generating: {
    label: 'Generating...',
    icon: Loader2,
    color: 'text-blue-600',
    animate: true
  },
  complete: {
    label: 'Ready',
    icon: CheckCircle2,
    color: 'text-green-600',
    animate: false
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600',
    animate: false
  }
};

export default function ChallengesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [resource, setResource] = useState<ResourceInfo | null>(null);
  const [progress, setProgress] = useState<Record<string, ChallengeProgressInfo>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getUserId());
    setGoalId(getGoalId());
  }, []);

  const fetchChallenges = useCallback(async () => {
    if (!userId || !goalId) return;

    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}/challenges`);
      if (!response.ok) throw new Error('Failed to fetch challenges');

      const data = await response.json();
      setChallenges(data.challenges || []);
      setStats(data.stats);
      setResource(data.resource);
      setProgress(data.progress || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, [userId, goalId]);

  useEffect(() => {
    if (userId && goalId) {
      fetchChallenges();
    }
  }, [userId, goalId, fetchChallenges]);

  // Poll for updates if there are pending/generating challenges
  useEffect(() => {
    if (!stats || (stats.pending === 0 && stats.generating === 0)) return;

    const interval = setInterval(fetchChallenges, 3000);
    return () => clearInterval(interval);
  }, [stats, fetchChallenges]);

  const generateChallenges = async () => {
    if (!userId || !goalId) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true })
      });

      if (!response.ok) throw new Error('Failed to generate challenges');

      await fetchChallenges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate challenges');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-muted-foreground">Loading challenges...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-red-500 mb-4">{error}</p>
        <Button asChild variant="outline">
          <Link href="/goal">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Goal
          </Link>
        </Button>
      </div>
    );
  }

  const completedCount = stats?.complete || 0;
  const totalCount = stats?.total || 0;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Group challenges by section
  const sectionGroups: SectionGroup[] = challenges.reduce((groups: SectionGroup[], challenge) => {
    const existingGroup = groups.find((g) => g.sectionId === challenge.sectionId);
    if (existingGroup) {
      existingGroup.challenges.push(challenge);
    } else {
      groups.push({
        sectionId: challenge.sectionId,
        sectionTitle: challenge.sectionTitle,
        challenges: [challenge]
      });
    }
    return groups;
  }, []);

  // Sort challenges within each group by difficulty order (easy, medium, hard)
  const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
  sectionGroups.forEach((group) => {
    group.challenges.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back Link */}
      <Link href="/goal" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Goal
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-3">Challenges</h1>
        {resource && (
          <p className="text-muted-foreground">
            Based on: <span className="font-medium text-foreground">{resource.title}</span>
            <span className="mx-2">•</span>
            <span>{resource.provider}</span>
          </p>
        )}
      </div>

      {/* Stats Bar */}
      {stats && totalCount > 0 && (
        <div className="mb-8 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {completedCount} of {totalCount} challenges ready
            </span>
            {stats.pending > 0 && (
              <Button size="sm" onClick={generateChallenges} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {stats.pending} Pending
                  </>
                )}
              </Button>
            )}
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            {stats.complete > 0 && <span className="text-green-600">{stats.complete} ready</span>}
            {stats.generating > 0 && <span className="text-blue-600">{stats.generating} generating</span>}
            {stats.pending > 0 && <span>{stats.pending} pending</span>}
            {stats.locked > 0 && <span>{stats.locked} locked</span>}
            {stats.failed > 0 && <span className="text-red-600">{stats.failed} failed</span>}
          </div>
        </div>
      )}

      {/* Challenges by Section */}
      {sectionGroups.length > 0 ? (
        <div className="space-y-10">
          {sectionGroups.map((group) => (
            <div key={group.sectionId}>
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-1 bg-accent rounded-full" />
                <h2 className="text-xl font-bold text-foreground">{group.sectionTitle}</h2>
              </div>

              {/* Challenge Cards - 3 per row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.challenges.map((challenge) => {
                  const diffConfig = DIFFICULTY_CONFIG[challenge.difficulty];
                  const statusConfig = STATUS_CONFIG[challenge.status];
                  const StatusIcon = statusConfig.icon;
                  const isReady = challenge.status === 'complete';
                  const isLocked = challenge.status === 'locked';
                  const isGenerating = challenge.status === 'generating';
                  const challengeProgress = progress[challenge.id];
                  const hasProgress = challengeProgress?.hasProgress && challengeProgress?.status !== 'completed';

                  return (
                    <Card
                      key={challenge.id}
                      className={`p-5 border transition-all flex flex-col ${
                        isReady ? 'hover:border-accent/50 hover:shadow-md' : isLocked ? 'opacity-60 bg-muted/30' : 'opacity-80'
                      }`}
                    >
                      {/* Header with Badge and Time */}
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="outline" className={isLocked ? 'bg-muted text-muted-foreground border-muted' : diffConfig.color}>
                          {isLocked ? (
                            <Lock className="h-3 w-3 mr-1" />
                          ) : challenge.difficulty === 'easy' ? (
                            <CheckCircle2 className={`h-3 w-3 mr-1 ${diffConfig.iconColor}`} />
                          ) : challenge.difficulty === 'medium' ? (
                            <Sparkles className={`h-3 w-3 mr-1 ${diffConfig.iconColor}`} />
                          ) : (
                            <Trophy className={`h-3 w-3 mr-1 ${diffConfig.iconColor}`} />
                          )}
                          {diffConfig.label}
                        </Badge>
                        {isReady ? (
                          <span className="text-sm text-muted-foreground">{diffConfig.time}</span>
                        ) : (
                          <span className={`text-xs flex items-center gap-1 ${statusConfig.color}`}>
                            <StatusIcon className={`h-3 w-3 ${statusConfig.animate ? 'animate-spin' : ''}`} />
                            {statusConfig.label}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className={`font-semibold mb-2 ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {challenge.difficulty === 'easy' && 'Fundamentals'}
                        {challenge.difficulty === 'medium' && 'Application'}
                        {challenge.difficulty === 'hard' && 'Advanced Concepts'}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-4 grow line-clamp-3">
                        {isLocked
                          ? challenge.difficulty === 'medium'
                            ? 'Complete 50% of the Easy challenge to unlock this level.'
                            : 'Complete 50% of the Medium challenge to unlock this level.'
                          : challenge.difficulty === 'easy'
                            ? `Test your understanding of basic ${group.sectionTitle.toLowerCase()} concepts and definitions.`
                            : challenge.difficulty === 'medium'
                              ? `Apply your knowledge to practical scenarios involving ${group.sectionTitle.toLowerCase()}.`
                              : `Master advanced ${group.sectionTitle.toLowerCase()} with complex problem-solving challenges.`}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className={`text-sm font-medium flex items-center gap-1 ${isLocked ? 'text-muted-foreground' : ''}`}>
                          <Trophy className={`h-4 w-4 ${isLocked ? 'text-muted-foreground' : 'text-accent'}`} />
                          {diffConfig.points} pts
                        </span>
                        {isReady ? (
                          <Link
                            href={`/challenges/start?challengeId=${challenge.id}`}
                            className="text-sm font-medium text-accent hover:text-accent/80 flex items-center"
                          >
                            {hasProgress ? 'Continue' : 'Start'}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Link>
                        ) : isLocked ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : isGenerating ? (
                          <span className="text-xs text-blue-600">Generating...</span>
                        ) : challenge.status === 'failed' ? (
                          <span className="text-xs text-red-500">Failed</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-2">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-bold text-foreground mb-2">No Challenges Yet</h3>
          <p className="text-muted-foreground mb-4">Select a learning resource for your goal to unlock challenges for each section.</p>
          <Button asChild>
            <Link href="/roadmap/results">Browse Resources</Link>
          </Button>
        </Card>
      )}

      {/* Pro Tip */}
      {challenges.length > 0 && (
        <div className="mt-10 p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Pro Tip:</span> Each challenge is based on a section from your learning
            resource. Complete them as you progress through the material to reinforce your understanding.
          </p>
        </div>
      )}
    </div>
  );
}
