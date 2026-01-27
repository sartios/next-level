import { z } from 'zod';

export const AvailableSlotSchema = z.object({
  day: z.string().describe('The day of the week'),
  startTime: z.string().describe('The start time of the slot'),
  endTime: z.string().describe('The end time of the slot'),
  durationMinutes: z.number().describe('The duration of the slot in minutes')
});

export const ResourceSchema = z.object({
  title: z.string().describe('The title of the resource'),
  link: z.string().describe('The link of the resource'),
  reasoning: z.string().describe('The reason of resource relevance to the skill'),
  provider: z.string().describe('The provider of the resource'),
  approximateHours: z.number().describe('The approximate hours for completing the resource'),
  relevancePercentage: z.number().describe('The relevance percentage of the resource to the goal'),
  sections: z
    .array(
      z.object({
        skill: z.string().describe('The skill of section focus'),
        location: z.string().describe('The specific place of the section within the resource')
      })
    )
    .describe('The relevant sections within the resource')
});

export const RoadmapStepStatusSchema = z.enum(['pending', 'started', 'completed']).describe('The status of the roadmap step');

export const TimelineSchema = z.object({
  date: z.string().describe('The scheduled date of a roadmap step'),
  startTime: z.string().describe('The start time of the slot'),
  endTime: z.string().describe('The end time of the slot'),
  durationMinutes: z.number().describe('The duration of the slot in minutes')
});

export const RoadmapStepSchema = z.object({
  step: z.string().describe('The name of the roadmap step'),
  description: z.string().describe('A detailed description of what this step involves'),
  resources: z.array(ResourceSchema).describe('The learning resources associated with this step'),
  status: RoadmapStepStatusSchema.describe('The current status of the step: pending, started, or completed'),
  timeline: z.array(TimelineSchema).describe('The scheduled time slots for working on this step')
});

export const PlanSessionSchema = z.object({
  day: z.string().describe('The day of the week for this session'),
  startTime: z.string().describe('The start time of the session'),
  endTime: z.string().describe('The end time of the session'),
  roadmapStep: z.string().describe('The roadmap step this session focuses on'),
  activities: z.array(z.string()).describe('The specific activities to complete during this session'),
  durationMinutes: z.number().describe('The duration of the session in minutes')
});

export const PlanWeekSchema = z.object({
  weekNumber: z.number().describe('The week number in the plan'),
  weekStartDate: z.string().describe('The start date of the week'),
  focusArea: z.string().describe('The main focus area for this week'),
  sessions: z.array(PlanSessionSchema).describe('The learning sessions scheduled for this week'),
  totalMinutes: z.number().describe('The total minutes of learning scheduled for this week'),
  completionPercentage: z.number().describe('The cumulative completion percentage after this week')
});

export const PlanSchema = z.object({
  totalWeeks: z.number().describe('The total number of weeks in the plan'),
  estimatedCompletionDate: z.string().describe('The estimated date when the goal will be completed'),
  weeks: z.array(PlanWeekSchema).describe('The weekly breakdown of the plan')
});

export const GoalSchema = z.object({
  id: z.string().describe('The unique identifier of the goal'),
  userId: z.string().describe('The user ID who owns this goal'),
  name: z.string().describe('The name of the goal'),
  reasoning: z.string().describe('The reasoning behind why this goal is important'),
  resources: z.array(ResourceSchema).optional().describe('Learning resources for the goal'),
  roadmap: z.array(RoadmapStepSchema).optional().describe('The step-by-step roadmap for achieving the goal'),
  plan: PlanSchema.optional().describe('The weekly plan for the goal')
});
