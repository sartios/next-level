/**
 * Centralized type definitions for the lib modules.
 * Types are defined here and re-exported from their original modules for backward compatibility.
 */

// ============================================================================
// Database Types (from Drizzle schema)
// ============================================================================

// Import the table definitions to infer types
import { learningResources, learningResourceSections, resourceEmbeddings, type EmbeddingContentType } from './db/schema';

// Re-export EmbeddingContentType for backward compatibility
export type { EmbeddingContentType };

// Learning Resource types
export type LearningResource = typeof learningResources.$inferSelect;
export type NewLearningResource = typeof learningResources.$inferInsert;

// Learning Resource Section types
export type LearningResourceSection = typeof learningResourceSections.$inferSelect;
export type NewLearningResourceSection = typeof learningResourceSections.$inferInsert;

// Resource Embedding types
export type ResourceEmbedding = typeof resourceEmbeddings.$inferSelect;
export type NewResourceEmbedding = typeof resourceEmbeddings.$inferInsert;

// ============================================================================
// Composite Types
// ============================================================================

/**
 * Learning resource with sections included
 */
export type LearningResourceWithSections = LearningResource & {
  sections: LearningResourceSection[];
};

/**
 * Search result type including the matched content
 */
export interface EmbeddingSearchResult {
  resourceId: string;
  contentType: EmbeddingContentType;
  contentIndex: number | null;
  sectionId: string | null;
  contentText: string;
  similarity: number;
  resource?: LearningResourceWithSections;
}

export type GoalResource = LearningResourceWithSections;
