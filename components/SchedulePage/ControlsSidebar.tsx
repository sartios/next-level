import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';

interface ControlsSidebarProps {
  weeksToComplete: number;
  onClick: () => void;
  disabled: boolean;
}

export default function ControlsSidebar({ weeksToComplete, onClick, disabled }: ControlsSidebarProps) {
  const getGraduationDate = () => {
    if (weeksToComplete === 0) return null;
    const today = new Date();
    const targetDate = new Date(today.getTime() + weeksToComplete * 7 * 24 * 60 * 60 * 1000);
    return targetDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <aside className="space-y-6">
      <div className="p-6 rounded-xl border-2 border-muted space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-black text-foreground">Recurring</p>
            <p className="text-sm text-border font-medium">Apply to all weeks</p>
          </div>
          <Switch checked={true} className="data-[state=checked]:bg-accent" disabled />
        </div>

        <div className="pt-4 border-t border-muted">
          <div className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
            <Info className="h-5 w-5 text-accent shrink-0" />
            <p className="text-foreground">
              {weeksToComplete ? (
                <>
                  Based on this schedule, your graduation target is <strong className="text-foreground">{getGraduationDate()}</strong>.
                </>
              ) : (
                <>Select time slots to see your graduation target.</>
              )}
            </p>
          </div>
        </div>

        <Button
          className="w-full min-h-14 bg-foreground text-background text-lg hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          onClick={onClick}
          disabled={disabled}
        >
          Save
        </Button>
      </div>
    </aside>
  );
}
