import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onDefineGoal?: () => void;
}

export default function HeroSection({ onDefineGoal }: HeroSectionProps) {
  return (
    <section className="relative bg-foreground text-background border-b border-border overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,hsl(214_32%_91%/0.1)_0%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="container mx-auto flex flex-col items-center px-4 py-24 text-center md:py-32 lg:py-40">
        <h1 className="max-w-4xl text-5xl font-extrabold sm:text-6xl md:text-7xl">
          Your AI-powered path from resolution to{' '}
          <span className="underline decoration-4 underline-offset-4 decoration-accent">reality</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-medium opacity-90 sm:text-2xl">
          Stop wishing and start achieving. Our AI analyzes your goals, creates personalized learning roadmaps, and adapts to your progress—so you actually stick with it past February.
        </p>

        <div className="mt-10 flex flex-col w-full sm:w-auto sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="w-full sm:w-auto h-14 text-lg font-bold bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-4 focus-visible:ring-offset-foreground transition-colors"
            onClick={onDefineGoal}
          >
            Define Your Goal Now
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto h-14 text-lg font-bold border-2 border-background text-background bg-transparent hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-4 focus-visible:ring-offset-foreground transition-colors"
            asChild
          >
            <a href="#how-it-works">See How It Works</a>
          </Button>
        </div>

        <p className="mt-8 text-base font-medium opacity-80">Powered by AI. Free to start. No credit card required.</p>
      </div>
    </section>
  );
}
