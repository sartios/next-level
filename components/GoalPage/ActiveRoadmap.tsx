'use client';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Check, X, MoreVertical } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Goal } from '@/lib/db/goalRepository';
import type { PlanSessionStatus } from '@/lib/db/schema';
import type { WeeklyPlanWithSessions } from '@/lib/db/weeklyPlanRepository';

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface GoalAvailability {
  weeklyHours: number;
  startDate: string;
  targetCompletionDate: string | null;
  slots: AvailabilitySlot[];
}

interface SelectedResource {
  id: string;
  title: string;
  totalHours: number | null;
}

/** Extended Goal type with enriched data from API */
interface EnrichedGoal extends Goal {
  availability?: GoalAvailability | null;
  currentWeekPlan?: WeeklyPlanWithSessions | null;
  selectedResource?: SelectedResource | null;
  userCareerGoals?: string[];
}

interface ActiveRoadmapProps {
  goal: EnrichedGoal | null;
  onSessionUpdate?: () => void;
}

interface ScheduleSlot {
  id?: string;
  time: string;
  endTime: string;
  duration: number;
  topic: string;
  activities: string[];
  status: 'completed' | 'started' | 'scheduled' | 'missed';
}

interface TopicStep {
  topic: string;
  sessions: ScheduleSlot[];
  status: 'completed' | 'started' | 'pending';
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ActiveRoadmap({ goal }: ActiveRoadmapProps) {
  const [, /*showArchiveDialog*/ setShowArchiveDialog] = useState(false);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [localSessions, setLocalSessions] = useState<Map<string, PlanSessionStatus>>(new Map());

  const updateSessionStatus = useCallback(
    async (sessionId: string, newStatus: PlanSessionStatus) => {
      if (!goal) return;

      // Store previous status for rollback
      const previousStatus = localSessions.get(sessionId);

      // Optimistic update
      setLocalSessions((prev) => new Map(prev).set(sessionId, newStatus));
      setUpdatingSessionId(sessionId);

      try {
        const response = await fetch(`/api/users/${goal.userId}/goals/${goal.id}/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
          // Rollback optimistic update
          if (previousStatus !== undefined) {
            setLocalSessions((prev) => new Map(prev).set(sessionId, previousStatus));
          } else {
            setLocalSessions((prev) => {
              const next = new Map(prev);
              next.delete(sessionId);
              return next;
            });
          }

          const data = await response.json().catch(() => ({}));
          const errorMessage = data.errorMessage || 'Failed to update session';
          toast.error(errorMessage);
        }
      } catch (error) {
        // Rollback optimistic update on network error
        if (previousStatus !== undefined) {
          setLocalSessions((prev) => new Map(prev).set(sessionId, previousStatus));
        } else {
          setLocalSessions((prev) => {
            const next = new Map(prev);
            next.delete(sessionId);
            return next;
          });
        }

        toast.error(`Failed to update session ${(error as unknown as Error).message}`);
      } finally {
        setUpdatingSessionId(null);
      }
    },
    [goal, localSessions]
  );

  const toggleSessionCompletion = useCallback(
    (sessionId: string, currentStatus: string) => {
      const newStatus: PlanSessionStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      updateSessionStatus(sessionId, newStatus);
    },
    [updateSessionStatus]
  );

  const getEffectiveStatus = useCallback(
    (sessionId: string | undefined, originalStatus: string): string => {
      if (sessionId && localSessions.has(sessionId)) {
        const status = localSessions.get(sessionId);
        if (status === 'completed') return 'completed';
        if (status === 'in_progress') return 'started';
        if (status === 'missed') return 'missed';
        return 'scheduled';
      }
      return originalStatus;
    },
    [localSessions]
  );

  if (!goal) {
    return (
      <div className="lg:col-span-2 space-y-8">
        <p className="text-muted-foreground">No active goal found.</p>
      </div>
    );
  }

  // Build weekly schedule from plan sessions (preferred) or availability slots (fallback)
  const weeklySchedule: Record<string, ScheduleSlot[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: []
  };

  // Map full day names to short names
  const dayToShort: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
  };

  // Map session status from database to display status
  const mapSessionStatus = (status: string): ScheduleSlot['status'] => {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'in_progress':
        return 'started';
      case 'missed':
        return 'missed';
      default:
        return 'scheduled';
    }
  };

  // Populate weekly schedule from currentWeekPlan sessions (preferred) or availability slots (fallback)
  if (goal.currentWeekPlan?.sessions) {
    goal.currentWeekPlan.sessions.forEach((session) => {
      const shortDay = dayToShort[session.dayOfWeek];
      if (shortDay && weeklySchedule[shortDay]) {
        const effectiveStatus = getEffectiveStatus(session.id, mapSessionStatus(session.status));
        weeklySchedule[shortDay].push({
          id: session.id,
          time: session.startTime,
          endTime: session.endTime,
          duration: session.durationMinutes,
          topic: session.topic,
          activities: session.activities,
          status: effectiveStatus as ScheduleSlot['status']
        });
      }
    });
  } else if (goal.availability?.slots) {
    goal.availability.slots.forEach((slot) => {
      const shortDay = dayToShort[slot.day];
      if (shortDay && weeklySchedule[shortDay]) {
        weeklySchedule[shortDay].push({
          time: slot.startTime,
          endTime: slot.endTime,
          duration: slot.durationMinutes,
          topic: '',
          activities: [],
          status: 'scheduled'
        });
      }
    });
  }

  const allSlots = Object.values(weeklySchedule).flat();
  const totalSlots = allSlots.length;
  const completedCount = allSlots.filter((s) => s.status === 'completed').length;
  const weeklyHours = goal.availability?.weeklyHours ?? 0;

  const topicSteps: TopicStep[] = [];
  const topicMap = new Map<string, ScheduleSlot[]>();

  // Group sessions by topic (preserving order of first appearance)
  allSlots.forEach((slot) => {
    if (slot.topic) {
      const existing = topicMap.get(slot.topic);
      if (existing) {
        existing.push(slot);
      } else {
        topicMap.set(slot.topic, [slot]);
      }
    }
  });

  // Convert to array and determine status for each topic
  topicMap.forEach((sessions, topic) => {
    const allCompleted = sessions.every((s) => s.status === 'completed');
    const anyStartedOrCompleted = sessions.some((s) => s.status === 'completed' || s.status === 'started');

    let status: TopicStep['status'] = 'pending';
    if (allCompleted) {
      status = 'completed';
    } else if (anyStartedOrCompleted) {
      status = 'started';
    }

    topicSteps.push({ topic, sessions, status });
  });

  // Calculate progress based on sessions
  const totalSteps = topicSteps.length;
  const completedSteps = topicSteps.filter((s) => s.status === 'completed').length;
  const startedSteps = topicSteps.filter((s) => s.status === 'started').length;
  const progress = totalSteps > 0 ? Math.max(5, Math.round((completedCount / totalSlots) * 100)) : 5;

  // Calculate graduation date
  const totalCourseHours = goal.selectedResource?.totalHours ?? 0;
  const hoursCompleted = completedCount * 0.5; // Each slot is 30 minutes
  const hoursRemaining = Math.max(0, totalCourseHours - hoursCompleted);
  const weeksRemaining = weeklyHours > 0 ? Math.ceil(hoursRemaining / weeklyHours) : 0;
  const graduationDate = new Date();
  graduationDate.setDate(graduationDate.getDate() + weeksRemaining * 7);
  const formattedGraduationDate = graduationDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div>
      <div className="flex flex-col xl:flex-row justify-between gap-8">
        <div className="space-y-8">
          <section className="space-y-4 mb-8 xl:mb-11">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Overall Progress</h2>
                <p className="text-muted-foreground font-medium">
                  {completedSteps} of {totalSteps} topics completed{startedSteps > 0 && `, ${startedSteps} in progress`}
                </p>
              </div>
              <span className="text-4xl font-black text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-4 bg-muted *:data-[slot='progress-indicator']:bg-accent" />
          </section>

          {/* Weekly Plan Section */}
          <section className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-1">
              <div>
                <h2 className="text-2xl font-bold text-foreground">This Week&apos;s Plan</h2>
                <p className="text-muted-foreground font-medium">Track your commitment and stay accountable</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Weekly commitment: <span className="font-semibold">{weeklyHours}h</span> ({totalSlots} slots)
              </p>
            </div>

            <Card className="border-2 border-muted shadow-none">
              <CardContent className="p-4">
                {/* Mobile view - only days with slots */}
                <div className="md:hidden max-h-104 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-5">
                    {days
                      .filter((day) => weeklySchedule[day].length > 0)
                      .map((day) => (
                        <div key={day} className="space-y-2">
                          <div className="text-center font-black text-xs text-border uppercase">{day}</div>
                          <div className="space-y-1">
                            {weeklySchedule[day].map((slot, idx) => {
                              const isUpdating = Boolean(slot.id && updatingSessionId === slot.id);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => slot.id && toggleSessionCompletion(slot.id, slot.status)}
                                  disabled={!slot.id || isUpdating}
                                  className={`min-h-16 w-full min-w-20 rounded-md flex flex-col items-center justify-center p-2 text-xs font-bold transition-all ${
                                    slot.status === 'completed'
                                      ? 'bg-green-100 hover:bg-green-200'
                                      : slot.status === 'started'
                                        ? 'bg-blue-100  hover:bg-blue-200'
                                        : slot.status === 'missed'
                                          ? 'bg-red-100 hover:bg-red-200'
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                  } ${slot.id ? 'cursor-pointer' : 'cursor-default'} ${isUpdating ? 'opacity-50' : ''}`}
                                  title={`${slot.topic ? `${slot.topic}\n` : ''}${slot.time} to ${slot.endTime} (${slot.duration}min)${slot.activities.length ? `\n• ${slot.activities.join('\n• ')}` : ''}\n\nClick to mark as ${slot.status === 'completed' ? 'incomplete' : 'completed'}`}
                                >
                                  <span className="text-xs">
                                    {slot.time}-{slot.endTime}
                                  </span>
                                  {slot.status === 'completed' ? (
                                    <Check className={`h-3 w-3 mt-0.5 ${isUpdating ? 'animate-pulse' : ''}`} />
                                  ) : slot.status === 'missed' ? (
                                    <X className={`h-3 w-3 mt-0.5 ${isUpdating ? 'animate-pulse' : ''}`} />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Tablet and above - full week view */}
                <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-34 -mx-2 px-2">
                  <div className="grid grid-cols-7 gap-2 min-w-max">
                    {days.map((day) => (
                      <div key={day} className="space-y-2 min-w-20">
                        <div className="text-center font-black text-sm text-border uppercase">{day}</div>
                        <div className="space-y-1">
                          {weeklySchedule[day].length > 0 ? (
                            weeklySchedule[day].map((slot, idx) => {
                              const isUpdating = Boolean(slot.id && updatingSessionId === slot.id);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => slot.id && toggleSessionCompletion(slot.id, slot.status)}
                                  disabled={!slot.id || isUpdating}
                                  className={`min-h-16 w-full min-w-20 rounded-md flex flex-col items-center justify-center p-2 text-xs font-bold transition-all ${
                                    slot.status === 'completed'
                                      ? 'bg-green-100  hover:bg-green-200'
                                      : slot.status === 'started'
                                        ? 'bg-blue-100  hover:bg-blue-200'
                                        : slot.status === 'missed'
                                          ? 'bg-red-100  hover:bg-red-200'
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                  } ${slot.id ? 'cursor-pointer' : 'cursor-default'} ${isUpdating ? 'opacity-50' : ''}`}
                                  title={`${slot.topic ? `${slot.topic}\n` : ''}${slot.time} to ${slot.endTime} (${slot.duration}min)${slot.activities.length ? `\n• ${slot.activities.join('\n• ')}` : ''}\n\nClick to mark as ${slot.status === 'completed' ? 'incomplete' : 'completed'}`}
                                >
                                  <span className="text-xs">
                                    {slot.time}-{slot.endTime}
                                  </span>
                                  {slot.status === 'completed' ? (
                                    <Check className={`h-3 w-3 mt-0.5 ${isUpdating ? 'animate-pulse' : ''}`} />
                                  ) : slot.status === 'missed' ? (
                                    <X className={`h-3 w-3 mt-0.5 ${isUpdating ? 'animate-pulse' : ''}`} />
                                  ) : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="min-h-16 w-full min-w-20 rounded-md bg-muted/30 flex items-center justify-center">
                              <span className="text-sm text-border font-bold">—</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
        <aside className="space-y-6 xl:w-250">
          <Card className="border-2 border-muted p-6 shadow-none">
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col">
                <h3 className="text-sm font-black uppercase text-border tracking-widest">Active Roadmap</h3>
                <h2 className="text-xl font-black text-foreground">{goal.selectedResource?.title ?? goal.name}</h2>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="h-11 w-11 p-0 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none inline-flex items-center justify-center"
                  aria-label="Goal options"
                >
                  <MoreVertical className="h-5 w-5 text-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setShowArchiveDialog(true)}
                    className="text-foreground font-medium cursor-pointer focus:bg-muted focus:text-foreground"
                  >
                    Archive goal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-bold uppercase text-border">Career Goals</p>
                <p className="text-lg font-medium text-foreground">{goal.userCareerGoals?.join(', ') || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm font-bold uppercase text-border">Core Skill</p>
                <p className="text-lg font-medium text-foreground">{goal.name}</p>
              </div>
            </div>
          </Card>

          <div className="xl:mt-11 p-6 bg-accent/10 rounded-2xl">
            <p className="text-sm xl:text-base font-medium text-foreground leading-relaxed">
              You are on track to graduate on <strong>{formattedGraduationDate}</strong> based on your current study pace.
            </p>
          </div>
        </aside>
      </div>
      {/* Roadmap Steps from Weekly Plan Topics */}
      {topicSteps.length > 0 && (
        <div className="space-y-4 w-full mt-6 xl:mt-11">
          <h3 className="text-2xl font-bold text-foreground">Roadmap Steps</h3>
          {topicSteps.map((step, idx) => {
            // Determine display status: first non-completed step is active, second non-completed is next
            const completedCount = topicSteps.slice(0, idx).filter((s) => s.status === 'completed').length;
            const isFirstPending = idx === completedCount && step.status !== 'completed';
            const isSecondPending = idx === completedCount + 1 && step.status !== 'completed';
            const displayStatus = step.status === 'completed' ? 'completed' : isFirstPending ? 'started' : 'pending';

            return (
              <div
                key={idx}
                className={`p-3 md:p-6 rounded-xl border-2 transition-all space-y-3 ${
                  displayStatus === 'completed' ? 'border-green-300' : displayStatus === 'started' ? 'border-blue-200' : 'border-muted'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-bold text-foreground text-lg">
                      Step {idx + 1}: {step.topic}
                    </h4>
                    {displayStatus === 'completed' && <CheckCircle2 className="hidden md:block h-6 w-6 shrink-0 text-green-500" />}
                    {displayStatus === 'started' && (
                      <Badge variant="outline" className="hidden md:inline-flex border-blue-500 text-blue-700 shrink-0">
                        In Progress
                      </Badge>
                    )}
                    {isSecondPending && (
                      <Badge variant="outline" className="hidden md:inline-flex border-border shrink-0">
                        Next Up
                      </Badge>
                    )}
                  </div>
                  {step.sessions.length > 0 && (
                    <div>
                      <p className="text-sm xl:text-base text-muted-foreground mb-2">Scheduled Sessions:</p>
                      <div className="flex flex-wrap gap-2">
                        {step.sessions.map((session, sIdx) => {
                          // Find which day this session is on
                          const dayEntry = Object.entries(weeklySchedule).find(([, slots]) =>
                            slots.some((s) => s.time === session.time && s.topic === session.topic)
                          );
                          const dayName = dayEntry ? dayEntry[0] : '';
                          const isUpdating = Boolean(session.id && updatingSessionId === session.id);

                          return (
                            <button
                              key={sIdx}
                              onClick={() => session.id && toggleSessionCompletion(session.id, session.status)}
                              disabled={!session.id || isUpdating}
                              className={`border-2 border-muted text-foreground text-sm px-2 py-3 rounded-md flex items-center gap-1 transition-all ${
                                session.status === 'completed'
                                  ? ' hover:bg-green-200'
                                  : session.status === 'started'
                                    ? ' hover:bg-blue-200'
                                    : session.status === 'missed'
                                      ? ' hover:bg-red-200'
                                      : 'hover:bg-muted'
                              } ${session.id ? 'cursor-pointer' : 'cursor-default'} ${isUpdating ? 'opacity-50' : ''}`}
                              title={`Click to mark as ${session.status === 'completed' ? 'incomplete' : 'completed'}`}
                            >
                              {session.status === 'completed' ? <Check className={`h-4 w-4 ${isUpdating ? 'animate-pulse' : ''}`} /> : null}
                              {dayName} {session.time}-{session.endTime}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {(() => {
                    // Collect all unique activities from all sessions
                    const allActivities = [...new Set(step.sessions.flatMap((s) => s.activities))];
                    return allActivities.length > 0 ? (
                      <div>
                        <p className="text-sm xl:text-base text-muted-foreground mb-2">Activities:</p>
                        <ul className="text-sm xl:text-base font-medium text-foreground space-y-1 list-disc list-inside">
                          {allActivities.map((activity, aIdx) => (
                            <li key={aIdx}>{activity}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  {displayStatus === 'completed' && (
                    <Button className="text-lg bg-foreground text-background min-h-11 px-6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold hover:bg-foreground/90">
                      Start Challenge
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
