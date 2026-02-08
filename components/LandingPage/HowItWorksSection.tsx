import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const steps = [
  {
    id: 1,
    step: 'Step 1',
    title: 'Share your aspirations',
    description:
      'Tell our AI agent about your career goals and interests. It analyses your background to suggest the most impactful skills to develop.'
  },
  {
    id: 2,
    step: 'Step 2',
    title: 'Select what to learn',
    description: 'Choose from our curated resources to find the perfect fit for your goals.'
  },
  {
    id: 3,
    step: 'Step 3',
    title: 'Create your weekly plan',
    description: 'Build a schedule that works for you to stay accountable. You can adjust your plan at any time if things change.'
  },
  {
    id: 4,
    step: 'Step 4',
    title: 'Get your personalised roadmap',
    description:
      'Our system creates a personalised weekly plan based on your selected resources and schedule to help you concentrate on your goals and track your weekly progress.'
  },
  {
    id: 5,
    step: 'Step 5',
    title: 'Practice with AI-crafted exercises',
    description:
      'Apply your knowledge through a series of exercises with varying difficulty levels. Reinforce your skills and track the progress you’ve made.'
  }
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-muted py-20 md:py-28">
      {/* Blurred gradient circle background */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-150 md:h-150 xl:w-225 xl:h-225 rounded-full opacity-60 blur-[60px] md:blur-[90px] xl:blur-[120px]"
        style={{
          background: 'radial-gradient(circle, #FFA500 0%, #FF6B6B 40%, transparent 70%)'
        }}
        aria-hidden="true"
      />
      <div className="container mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-foreground sm:text-5xl">From Goal to Done</h2>
          <p className="mt-4 text-lg xl:text-xl text-foreground mx-auto px-4 xl:px-0">
            A clear, step-by-step path to help you cross the finish line.
          </p>
        </div>
        {/* Steps in Single Card */}
        <div className="max-w-3xl mx-auto px-4">
          <Card className="border-2 border-muted">
            <CardContent className="p-0">
              {steps.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 py-4 xl:py-6 px-4 xl:px-16">
                  <div className="flex-1 flex flex-col md:flex-row gap-4">
                    <Badge variant="outline" className="shrink-0 text-sm font-medium px-4 py-1 border-0 text-accent bg-accent/10">
                      {item.step}
                    </Badge>
                    <h3 className="text-2xl font-bold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-base xl:text-lg text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
