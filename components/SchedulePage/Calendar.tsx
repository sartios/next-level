'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Loader2 } from 'lucide-react';

interface CalendarProps {
  isLoading: boolean;
  selectedSlots: string[];
  toggleSlot: (id: string) => void;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const generateTimeSlots = () => {
  const times = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }

  return times;
};

function getEndTime24h(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const endMinutes = minutes + 30;
  const endHours = endMinutes >= 60 ? hours + 1 : hours;
  return `${String(endHours % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
}

export default function Calendar({ isLoading, selectedSlots, toggleSlot }: CalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState(days[0]);

  useEffect(() => {
    setTimeout(() => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const rowHeight = 56;
        const targetIndex = 16;
        viewport.scrollTop = rowHeight * targetIndex;
      }
    }, 100);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const viewport = mobileScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const rowHeight = 57; // py-4 (32px) + text height (~25px)
        const targetIndex = 16;
        viewport.scrollTop = rowHeight * targetIndex;
      }
    }, 100);
  }, [selectedDay]);

  const timeSlots = generateTimeSlots();

  return (
    <div className="lg:col-span-3 space-y-4">
      {/* Mobile view */}
      <div className="md:hidden">
        <div className="border-2 border-muted rounded-xl bg-background">
          {/* Day picker - horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto p-4 pb-2 scrollbar-hide">
            {days.map((day) => {
              const isActive = selectedDay === day;
              const hasSlots = selectedSlots.some((s) => s.startsWith(`${day}-`));
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  disabled={isLoading}
                  className={`shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    isActive ? 'border-foreground' : 'border-muted'
                  }`}
                >
                  <span className="font-black text-sm text-border uppercase tracking-tighter">{day.slice(0, 3)}</span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      hasSlots ? 'bg-foreground' : isActive ? 'border-2 border-border' : 'border-2 border-muted'
                    }`}
                  >
                    {hasSlots && <Check className="h-3 w-3 text-background" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Time slots list */}
          <ScrollArea className="h-[400px] relative" ref={mobileScrollRef}>
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            )}
            <div className="px-4">
              {timeSlots.map((time) => {
                const id = `${selectedDay}-${time}`;
                const isSelected = selectedSlots.includes(id);
                return (
                  <button
                    key={time}
                    onClick={() => toggleSlot(id)}
                    disabled={isLoading}
                    aria-label={`Select ${selectedDay} at ${time}`}
                    className="w-full flex items-center gap-4 py-4 border-b border-muted text-left"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'bg-foreground border-foreground text-background' : 'border-muted hover:border-border'
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    <span className="font-bold text-sm text-border">
                      {time}-{getEndTime24h(time)}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[600px] border-2 border-muted rounded-xl bg-background p-4">
          <div className="grid grid-cols-8 gap-2 pb-2">
            <div className="h-10"></div> {/* Spacer for time column */}
            {days.map((day) => (
              <div
                key={day}
                className="flex items-center justify-center font-black text-sm text-border pb-2 uppercase tracking-tighter pr-4"
              >
                {day.slice(0, 3)}
              </div>
            ))}
          </div>

          <ScrollArea className="h-[400px] relative" ref={scrollRef}>
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            )}
            <div className="grid grid-cols-8 gap-2 pr-4">
              {timeSlots.map((time) => (
                <div key={time} className="contents">
                  <div className="text-right pr-4 text-xs lg:text-sm font-bold text-border self-center">{time}</div>
                  {days.map((day) => {
                    const id = `${day}-${time}`;
                    const isSelected = selectedSlots.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleSlot(id)}
                        disabled={isLoading}
                        aria-label={`Select ${day} at ${time}`}
                        className={`h-12 rounded-md border transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          isSelected
                            ? 'bg-foreground border-foreground text-background shadow-inner scale-[0.98]'
                            : 'bg-background border-muted hover:border-border'
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 mx-auto" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
