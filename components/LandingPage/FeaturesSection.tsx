import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Route, Brain, Trophy } from 'lucide-react';

const features = [
  {
    id: 1,
    icon: Sparkles,
    title: 'AI-Powered Goal Discovery',
    description:
      'Tell us your aspirations and our AI identifies the most impactful skills to develop based on your career stage and interests.'
  },
  {
    id: 2,
    icon: Route,
    title: 'Smart Learning Roadmaps',
    description:
      'AI generates personalized weekly schedules with curated resources, adapting the pace and content to match your learning style.'
  },
  {
    id: 3,
    icon: Brain,
    title: 'Intelligent Progress Insights',
    description: 'Our AI analyzes your learning patterns, suggests when to push harder or take breaks, and predicts your path to mastery.'
  },
  {
    id: 4,
    icon: Trophy,
    title: 'Adaptive Rewards System',
    description: 'AI-designed challenges and milestones that evolve with your progress, keeping you motivated with meaningful achievements.'
  }
];

export default function FeaturesSection() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-foreground sm:text-5xl">AI that understands your learning journey</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Our intelligent agents work behind the scenes to create personalized experiences that adapt to how you learn best.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                className="border-2 border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10" aria-hidden="true">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-foreground">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-base text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
