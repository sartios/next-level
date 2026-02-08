import { z } from 'zod';

// ============================================================================
// Learning Resource Schemas
// ============================================================================

export const LearningResourceSectionSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int().nullable(),
  orderIndex: z.number().int(),
  topics: z.array(z.string()).default([])
});

export const LearningResourceSchema = z.object({
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

// ============================================================================
// Challenge Question Schemas
// ============================================================================

export const optionLabelSchema = z.enum(['A', 'B', 'C', 'D']);

export const questionOptionSchema = z.object({
  label: optionLabelSchema,
  text: z.string().min(1)
});

export const generatedQuestionSchema = z.object({
  questionNumber: z.number().int().positive(),
  question: z.string().min(1),
  options: z.array(questionOptionSchema).length(4),
  correctAnswer: optionLabelSchema,
  explanation: z.string().min(1),
  hint: z.string().optional()
});

export const generatedQuestionsSchema = z.array(generatedQuestionSchema);

/**
 * Accepts both array [{ label, text }] and object { A, B, C, D } shapes.
 * Validates with Zod and returns stable A-D order.
 */
export const optionsNormalizationSchema = z
  .union([
    z.array(questionOptionSchema).length(4),
    z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) })
  ])
  .transform((val) => {
    const arr = Array.isArray(val) ? val : (['A', 'B', 'C', 'D'] as const).map((label) => ({ label, text: val[label] }));

    const labels = arr.map((o) => o.label).sort();
    if (labels.join(',') !== 'A,B,C,D') {
      throw new Error(`Options must have labels A, B, C, D — got ${labels.join(', ')}`);
    }

    return (['A', 'B', 'C', 'D'] as const).map((label) => arr.find((o) => o.label === label)!);
  });

// ============================================================================
// Agent Schemas
// ============================================================================

export const SkillSchema = z.object({
  name: z.string(),
  priority: z.number(),
  reasoning: z.string()
});

export const SearchQueriesSchema = z.object({
  queries: z.array(z.string()).min(1).max(5).describe('Search queries to find relevant learning resources')
});

export const RetrieverOutputSchema = z.object({
  resources: z.array(LearningResourceWithSectionsSchema)
});

// ============================================================================
// Resource Import Schemas
// ============================================================================

export const ResourceSectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  estimatedMinutes: z.number().int().positive().optional(),
  topics: z.array(z.string()).optional().default([])
});

export const ImportResourceSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().min(1, 'Title is required'),
  provider: z.string().min(1, 'Provider is required'),
  resourceType: z.enum(['course', 'book', 'tutorial', 'article']),
  description: z.string().optional(),
  learningObjectives: z.array(z.string()).optional().default([]),
  targetAudience: z.array(z.string()).optional().default([]),
  totalHours: z.number().positive().optional(),
  sections: z.array(ResourceSectionSchema).optional().default([])
});

export const ImportFileSchema = z.object({
  resources: z.array(ImportResourceSchema).min(1, 'At least one resource is required')
});
