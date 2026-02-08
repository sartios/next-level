import { z } from 'zod';
import { ResourceSectionSchema, ImportResourceSchema, ImportFileSchema } from '@/lib/validation/schemas';

// Re-export schemas
export { ResourceSectionSchema, ImportResourceSchema, ImportFileSchema };

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
