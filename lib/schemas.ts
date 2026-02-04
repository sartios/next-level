import { z } from 'zod';

const LearningResourceSectionSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int().nullable(),
  orderIndex: z.number().int(),
  topics: z.array(z.string()).default([])
});

const LearningResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  provider: z.string(),
  resourceType: z.enum(['course', 'book', 'tutorial', 'article']),
  learningObjectives: z.array(z.string()).default([]),
  targetAudience: z.array(z.string()).default([]),
  totalHours: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const LearningResourceWithSectionsSchema = LearningResourceSchema.extend({
  sections: z.array(LearningResourceSectionSchema)
});
