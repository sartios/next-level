import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onBack: () => void;
}

export default function BackButton({ onBack }: BackButtonProps) {
  return (
    <Button
      onClick={onBack}
      variant="ghost"
      className="flex items-center gap-2 font-medium text-base xl:text-lg min-h-14 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <ArrowLeft className="h-5 w-5" />
      Back
    </Button>
  );
}
