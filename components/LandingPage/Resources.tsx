import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Timer, CheckCircle2, BookOpen } from 'lucide-react';

import { Goal } from '@/lib/mockDb';

interface ResourcesProps {
  goal: Goal;
}

export default function Resources({ goal }: ResourcesProps) {
  return (
    <>
      <div className="space-y-10">
        {goal.resources?.map((resource, index) => (
          <Card key={resource.title} className="border-2 border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-6 md:p-8">
                <div className="flex items-center gap-4 mb-4">
                  <Badge className="bg-accent/10 text-accent border-0 font-bold">{resource.relevancePercentage}% Match</Badge>
                  <span className="text-border font-bold text-sm uppercase tracking-tight">{resource.provider}</span>
                </div>

                <h2 className="text-2xl font-black mb-6">
                  <a
                    className="inline-block text-foreground hover:text-accent transition-colors duration-200"
                    href={resource.url}
                    target="_blank"
                  >
                    {resource.title}
                  </a>
                </h2>

                <div className="flex gap-8 mb-8">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-accent" />
                    <span className="font-bold text-foreground">{resource.totalHours} Hours</span>
                  </div>
                </div>
                <div className="text-base leading-normal text-foreground pb-4">{resource.reasoning}</div>
                <Accordion type="single" collapsible defaultValue={index === 0 ? 'sections' : undefined} className="w-full">
                  <AccordionItem value="sections" className="border-none">
                    <AccordionTrigger className="lg:text-xl text-accent font-medium hover:text-accent/80 hover:no-underline hover:bg-accent/5 focus-visible:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 py-4 px-3 -mx-3 rounded-lg min-h-[44px] transition-colors group">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 shrink-0" />
                        Check What You&apos;ll Learn
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 pb-4">
                        {resource.sections.map((s) => (
                          <li key={s.id} className="flex items-start gap-2 bg-background p-3 rounded-md border border-muted">
                            <CheckCircle2 className="h-4 w-4 text-accent mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-foreground font-bold">{s.title}</span>
                              {s.topics?.map((t) => (
                                <span className="text-muted-foreground text-sm font-medium" key={t}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
