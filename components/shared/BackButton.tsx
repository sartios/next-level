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
      className="flex items-center gap-2 font-bold min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <ArrowLeft className="h-5 w-5" />
      Back
    </Button>
  );
}
