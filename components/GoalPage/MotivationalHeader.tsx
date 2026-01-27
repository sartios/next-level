import { BrainCircuit } from 'lucide-react';

export default function MotivationalHeader() {
  return (
    <header className="mb-12 bg-foreground p-8 md:p-12 rounded-3xl text-background relative overflow-hidden">
      <div className="relative z-10 space-y-4">
        <p className="text-accent font-black uppercase tracking-[0.2em] text-sm">Today&apos;s Focus</p>
        <h1 className="text-3xl md:text-5xl font-black italic leading-tight max-w-2xl">
          &quot;The secret of getting ahead is getting started.&quot;
        </h1>
        <p className="text-border font-bold">— Mark Twain</p>
      </div>
      <BrainCircuit className="absolute right-[-20px] bottom-[-20px] h-64 w-64 text-background/5" />
    </header>
  );
}
