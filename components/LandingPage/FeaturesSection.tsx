import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Route, Goal, Trophy } from 'lucide-react';

const features = [
  {
    id: 1,
    icon: Target,
    title: 'Define',
    description: 'Share your goals and let AI analyze your path.'
  },
  {
    id: 2,
    icon: Goal,
    title: 'Curate',
    description: 'Select from expert-vetted resources.'
  },
  {
    id: 3,
    icon: Route,
    title: 'Plan',
    description: 'Build a flexible schedule that keeps you accountable.'
  },
  {
    id: 4,
    icon: Trophy,
    title: 'Master',
    description: 'Practice with AI-crafted exercises and track your growth.'
  }
];

export default function FeaturesSection() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-foreground sm:text-5xl px-4 xl:px-0">Everything you need to succeed</h2>
          <p className="mt-4 text-lg xl:text-xl text-muted-foreground max-w-3xl mx-auto px-4 xl:px-0">
            Helping you stay on track and reach your learning goals, one day at a time.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto px-4 xl:px-0">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                className="bg-accent/10 border-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              >
                <CardHeader>
                  <Icon className="h-10 w-10 text-accent" />
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-2xl font-bold text-foreground">{feature.title}</CardTitle>
                  <p className="text-base xl:text-lg leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
