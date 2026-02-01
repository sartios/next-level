import { BrainCircuit } from 'lucide-react';

export default function MotivationalHeader() {
  return (
    <header className="mb-12 bg-foreground p-8 md:p-10 rounded-3xl text-background relative overflow-hidden">
      <div className="relative z-10 space-y-4">
        <p className="text-accent font-black uppercase tracking-[0.2em] text-sm">Today&apos;s Focus</p>
        <h1 className="text-3xl md:text-4xl font-bold italic leading-tight">&quot;The secret of getting ahead is getting started.&quot;</h1>
        <p className="text-border font-bold">— Mark Twain</p>
      </div>
      <BrainCircuit className="absolute -right-4 -bottom-4 h-32 w-32 text-background/20" />
    </header>
  );
}
