import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for a section within a learning resource
 */
export const ResourceSectionSchema = z.object({
  title: z.string().min(1, 'Section title is required'),
  estimatedMinutes: z.number().int().positive().optional(),
  topics: z.array(z.string()).optional().default([])
});

/**
 * Schema for a single learning resource in the import file
 */
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

/**
 * Schema for the complete import file
 */
export const ImportFileSchema = z.object({
  resources: z.array(ImportResourceSchema).min(1, 'At least one resource is required')
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

export type ResourceSection = z.infer<typeof ResourceSectionSchema>;
export type ImportResource = z.infer<typeof ImportResourceSchema>;
export type ImportFile = z.infer<typeof ImportFileSchema>;

/**
 * Result of importing a single resource
 */
export interface ImportResourceResult {
  url: string;
  title: string;
  success: boolean;
  resourceId?: string;
  error?: string;
}

/**
 * Result of the complete import operation
 */
export interface ImportResult {
  totalResources: number;
  successCount: number;
  failureCount: number;
  results: ImportResourceResult[];
}

/**
 * Options for the import operation
 */
export interface ImportOptions {
  dryRun?: boolean;
}
