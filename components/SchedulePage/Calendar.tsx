'use client';

import { useEffect, useRef } from 'react';
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

export default function Calendar({ isLoading, selectedSlots, toggleSlot }: CalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="lg:col-span-3 space-y-4">
      <div className="overflow-x-auto">
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
              {generateTimeSlots().map((time) => (
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
