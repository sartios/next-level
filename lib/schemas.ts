import { z } from 'zod';

export const SkillSchema = z.object({
  skill: z.string(),
  rationale: z.string(),
  confidence: z.number()
});

export const PlanSchema = z.object({
  focus: z.string(),
  sessions: z.array(z.string()),
  total_minutes: z.number()
});
