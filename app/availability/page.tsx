'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TimeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface AvailableSlots {
  Monday: TimeSlot[];
  Tuesday: TimeSlot[];
  Wednesday: TimeSlot[];
  Thursday: TimeSlot[];
  Friday: TimeSlot[];
  Saturday: TimeSlot[];
  Sunday: TimeSlot[];
}

export default function AvailabilityPage() {
  const router = useRouter();
  const userId = '123';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ [key: string]: { start: string; end: string } }>({});
  const [skillsBeingGenerated, setSkillsBeingGenerated] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Trigger skill suggestion in the background when page loads
  useEffect(() => {
    const generateSkills = async () => {
      if (!userId) {
        setError('User ID not found. Please start from the beginning.');
        return;
      }

      setSkillsBeingGenerated(true);
      try {
        await fetch('/api/skills/suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId
          })
        });
      } catch (err) {
        console.error('Failed to generate skills:', err);
      } finally {
        setSkillsBeingGenerated(false);
      }
    };

    generateSkills();
  }, [userId]);

  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
      const newTimeSlots = { ...timeSlots };
      delete newTimeSlots[day];
      setTimeSlots(newTimeSlots);
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    setTimeSlots({
      ...timeSlots,
      [day]: {
        ...timeSlots[day],
        [field]: value
      }
    });
  };

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    return endHour * 60 + endMin - (startHour * 60 + startMin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!userId) {
      setError('User ID not found. Please start from the beginning.');
      setLoading(false);
      return;
    }

    try {
      const availableSlots: AvailableSlots = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: []
      };

      let totalMinutes = 0;

      selectedDays.forEach((day) => {
        const slot = timeSlots[day];
        if (slot && slot.start && slot.end) {
          const duration = calculateDuration(slot.start, slot.end);
          availableSlots[day as keyof AvailableSlots] = [
            {
              startTime: slot.start,
              endTime: slot.end,
              durationMinutes: duration
            }
          ];
          totalMinutes += duration;
        }
      });

      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          startDate: new Date().toISOString().split('T')[0],
          totalHours: totalMinutes / 60,
          availableSlots
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // Redirect to skills selection page
      router.push(`/skills/select?userId=${userId}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <h1 className="text-2xl font-bold text-center mb-8">Set Your Weekly Availability</h1>

        {skillsBeingGenerated && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-blue-800 text-sm">
            ✨ AI is analyzing your profile and preparing personalized skill suggestions...
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-lg border">
          <p className="text-gray-600 mb-6">Select the days you are available to learn and set your time slots for each day.</p>

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day} className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id={day}
                      checked={selectedDays.includes(day)}
                      onChange={() => handleDayToggle(day)}
                      className="w-5 h-5 text-blue-600 mr-3"
                    />
                    <label htmlFor={day} className="text-lg font-semibold text-black">
                      {day}
                    </label>
                  </div>

                  {selectedDays.includes(day) && (
                    <div className="flex gap-4 ml-8">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={timeSlots[day]?.start || ''}
                          onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={timeSlots[day]?.end || ''}
                          onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <span className="text-sm text-gray-600 pb-2">
                          {timeSlots[day]?.start && timeSlots[day]?.end
                            ? `${calculateDuration(timeSlots[day].start, timeSlots[day].end)} min`
                            : '0 min'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || selectedDays.length === 0}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
