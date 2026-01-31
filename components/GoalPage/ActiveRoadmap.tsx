import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Check, X } from 'lucide-react';
import { Goal } from '@/lib/mockDb';

interface ActiveRoadmapProps {
  goal: Goal | null;
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ActiveRoadmap({ goal }: ActiveRoadmapProps) {
  if (!goal) {
    return (
      <div className="lg:col-span-2 space-y-8">
        <p className="text-muted-foreground">No active goal found.</p>
      </div>
    );
  }

  const roadmap = goal.roadmap || [];
  const completedSteps = roadmap.filter((step) => step.status === 'completed').length;
  const startedSteps = roadmap.filter((step) => step.status === 'started').length;
  const totalSteps = roadmap.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Build weekly schedule from roadmap timeline using dates
  interface ScheduleSlot {
    date: string;
    time: string;
    endTime: string;
    duration: number;
    stepName: string;
    stepIndex: number;
    status: 'completed' | 'started' | 'scheduled' | 'missed';
  }

  const weeklySchedule: Record<string, ScheduleSlot[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: []
  };

  // Get current week's date range (Monday to Sunday)
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Day index to short name mapping
  const dayIndexToShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  roadmap.forEach((step, stepIndex) => {
    step.timeline?.forEach((slot) => {
      const slotDate = new Date(slot.date);

      // Only include slots within the current week
      if (slotDate >= weekStart && slotDate <= weekEnd) {
        const dayOfWeek = slotDate.getDay();
        const shortDay = dayIndexToShort[dayOfWeek];

        if (weeklySchedule[shortDay]) {
          weeklySchedule[shortDay].push({
            date: slot.date,
            time: slot.startTime,
            endTime: slot.endTime,
            duration: slot.durationMinutes,
            stepName: step.step,
            stepIndex: stepIndex + 1,
            status: step.status === 'completed' ? 'completed' : step.status === 'started' ? 'started' : 'scheduled'
          });
        }
      }
    });
  });

  const completedCount = Object.values(weeklySchedule)
    .flat()
    .filter((s) => s.status === 'completed').length;
  const startedCount = Object.values(weeklySchedule)
    .flat()
    .filter((s) => s.status === 'started').length;
  const missedCount = Object.values(weeklySchedule)
    .flat()
    .filter((s) => s.status === 'missed').length;

  return (
    <div className="lg:col-span-2 space-y-8">
      <section className="space-y-4">
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-black uppercase text-border tracking-widest">Active Roadmap</h3>
          <h2 className="text-2xl font-black text-foreground">{goal.name}</h2>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Overall Progress</h2>
            <p className="text-muted-foreground font-medium">
              {completedSteps} of {totalSteps} steps completed{startedSteps > 0 && `, ${startedSteps} in progress`}
            </p>
          </div>
          <span className="text-4xl font-black text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-4 bg-muted *:data-[slot='progress-indicator']:bg-accent" />
      </section>

      {/* Weekly Plan Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">This Week&apos;s Plan</h2>
            <p className="text-muted-foreground font-medium">Track your commitment and stay accountable</p>
          </div>
          <div className="flex gap-4 text-sm font-bold">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300"></div>
              <span className="text-foreground">{completedCount} Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-300"></div>
              <span className="text-foreground">{startedCount} Started</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300"></div>
              <span className="text-foreground">{missedCount} Missed</span>
            </div>
          </div>
        </div>

        <Card className="border-2 border-muted">
          <CardContent className="p-6">
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="grid grid-cols-7 gap-2 min-w-max">
                {days.map((day) => (
                  <div key={day} className="space-y-2 min-w-20">
                    <div className="text-center font-black text-xs text-border uppercase">{day}</div>
                    <div className="space-y-1">
                      {weeklySchedule[day].length > 0 ? (
                        weeklySchedule[day].map((slot, idx) => (
                          <div
                            key={idx}
                            className={`min-h-16 rounded-md border-2 flex flex-col items-center justify-center p-1 text-xs font-bold ${
                              slot.status === 'completed'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : slot.status === 'started'
                                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                  : slot.status === 'missed'
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : 'bg-muted border-muted text-muted-foreground'
                            }`}
                            title={`Step ${slot.stepIndex}: ${slot.stepName} - ${slot.time} to ${slot.endTime} (${slot.duration}min)`}
                          >
                            <span className="text-[10px]">
                              {slot.time}-{slot.endTime}
                            </span>
                            <span className="text-[9px] opacity-75">{slot.duration}min</span>
                            {slot.status === 'completed' && <Check className="h-3 w-3 mt-0.5" />}
                            {slot.status === 'missed' && <X className="h-3 w-3 mt-0.5" />}
                          </div>
                        ))
                      ) : (
                        <div className="min-h-16 rounded-md bg-muted/30 border-2 border-dashed border-muted flex items-center justify-center">
                          <span className="text-[10px] text-border font-bold">—</span>
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

      {/* Roadmap Steps */}
      {roadmap.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-foreground">Roadmap Steps</h3>
          {roadmap.map((step, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-xl border-2 transition-all space-y-3 ${
                step.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : step.status === 'started'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-muted opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-700 shrink-0 mt-1" />
                ) : step.status === 'started' ? (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-500 bg-blue-100 shrink-0 mt-1" />
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-muted shrink-0 mt-1" />
                )}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-black text-foreground text-lg">
                      Step {idx + 1}: {step.step}
                    </h4>
                    {step.status === 'started' && (
                      <Badge variant="outline" className="border-blue-500 text-blue-700 shrink-0">
                        In Progress
                      </Badge>
                    )}
                    {step.status === 'pending' && idx === completedSteps + startedSteps && (
                      <Badge variant="outline" className="border-border shrink-0">
                        Next Up
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">{step.description}</p>
                  {step.timeline && step.timeline.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-border mb-1">Scheduled Sessions:</p>
                      <div className="flex flex-wrap gap-2">
                        {(step.timeline ?? []).map((slot, tIdx) => (
                          <span
                            key={tIdx}
                            className={`text-xs px-2 py-1 rounded-md ${
                              step.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : step.status === 'started'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                            {slot.startTime}-{slot.endTime} ({slot.durationMinutes}min)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {step.resources.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-border mb-1">Resources:</p>
                      <ul className="text-sm font-medium text-muted-foreground space-y-1">
                        {step.resources.map((resource, rIdx) => (
                          <li key={rIdx}>
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                              {resource.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {step.status === 'completed' && (
                    <Button className="bg-foreground text-background min-h-11 px-6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold hover:bg-foreground/90">
                      Start Challenge
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
