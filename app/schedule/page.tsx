'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Target } from 'lucide-react';
import Link from 'next/link';
import ControlsSidebar from '@/components/SchedulePage/ControlsSidebar';
import Calendar from '@/components/SchedulePage/Calendar';
import { getUserId, getGoalId } from '@/lib/storage';

interface GoalWithResource {
  id: string;
  name: string;
  selectedResource: {
    id: string;
    title: string;
    totalHours: number | null;
  } | null;
}

function ScheduleContent() {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [goal, setGoal] = useState<GoalWithResource | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUserId(getUserId());
    setGoalId(getGoalId());
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!userId || !goalId) {
          setIsLoading(false);
          return;
        }

        // Fetch goal with selected resource
        if (userId && goalId) {
          const goalResponse = await fetch(`/api/users/${userId}/goals/${goalId}`);
          if (goalResponse.ok) {
            const goalData = await goalResponse.json();
            setGoal(goalData.goal);
          }
        }

        // Fetch existing availability
        const availabilityResponse = await fetch(`/api/users/${userId}/goals/${goalId}/availability`);
        if (availabilityResponse.ok) {
          const data = await availabilityResponse.json();
          if (data.availability?.availableSlots) {
            const slots = data.availability.availableSlots.map(
              (slot: { day: string; startTime: string }) => `${slot.day}-${slot.startTime}`
            );
            setSelectedSlots(slots);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, goalId]);

  const totalCourseHours = goal?.selectedResource?.totalHours || 24;
  const hoursPerSlot = 0.5; // Each block is 30 minutes (0.5 hours)
  const weeklyHours = selectedSlots.length * hoursPerSlot;
  const weeksToComplete = weeklyHours > 0 ? Math.ceil(totalCourseHours / weeklyHours) : 0;

  const toggleSlot = (id: string) => {
    setSelectedSlots((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (selectedSlots.length === 0) return;
    if (!userId) return;

    setIsSaving(true);
    try {
      // Transform selectedSlots into flat array of available slots
      const availableSlots = selectedSlots.map((slot) => {
        const [day, startTime] = slot.split('-');
        const [hours, minutes] = startTime.split(':').map(Number);
        const endMinutes = minutes + 30;
        const endHours = endMinutes >= 60 ? hours + 1 : hours;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        return {
          day,
          startTime,
          endTime,
          durationMinutes: 30
        };
      });

      const response = await fetch(`/api/users/${userId}/goals/${goalId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goalId,
          startDate: new Date().toISOString().split('T')[0],
          totalHours: weeklyHours,
          availableSlots
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save availability');
      }
      router.push('/goal');
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Card className="p-8 text-center border-2 border-muted shadow-none">
          <Loader2 className="h-12 w-12 mx-auto text-accent mb-4 animate-spin" />
          <h3 className="text-2xl xl:text-3xl font-bold text-foreground">Loading your schedule...</h3>
          <p className="xl:text-xl text-muted-foreground">Please wait while we fetch your schedule</p>
        </Card>
      );
    }

    if (!goal) {
      return (
        <Card className="p-8 text-center border-2 border-muted shadow-none">
          <Target className="h-12 w-12 mx-auto text-accent mb-4" />
          <h3 className="text-2xl xl:text-3xl font-bold text-foreground">Set your goal to begin</h3>
          <p className="xl:text-xl text-muted-foreground mb-4">Define your aspirations and build your schedule.</p>
          <Button
            asChild
            className="w-full lg:w-1/3 h-16 text-xl bg-foreground text-background hover:opacity-90 rounded-xl shadow-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold mx-auto"
          >
            <Link href="/">Define your goal</Link>
          </Button>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <Calendar isLoading={isLoading} selectedSlots={selectedSlots} toggleSlot={toggleSlot} />
        <ControlsSidebar weeksToComplete={weeksToComplete} onClick={handleSave} disabled={isSaving || selectedSlots.length === 0} />
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 xl:px-0 py-10 xl:py-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">Architect your week</h1>
          <p className="text-xl text-muted-foreground font-medium leading-relaxed">Select your recurring deep-focus slots.</p>
        </div>

        <Card className="bg-background border-2 border-border p-4 flex gap-8">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-border">Weekly Commitment</p>
            <p className="text-2xl font-black text-foreground">{weeklyHours}h</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-border">Completion Time</p>
            <p className="text-2xl font-black text-accent">{weeksToComplete || '--'} Weeks</p>
          </div>
        </Card>
      </header>

      {renderContent()}
    </div>
  );
}

export default function SchedulePage() {
  return <ScheduleContent />;
}
