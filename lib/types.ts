/**
 * Centralized type definitions for the lib modules.
 * Types are defined here and re-exported from their original modules for backward compatibility.
 */

// ============================================================================
// Database Types (from Drizzle schema)
// ============================================================================

// Import the table definitions to infer types
import { skills, learningResources, learningResourceSections, skillResources, resourceEmbeddings } from './db/schema';

// Skill types
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

// Learning Resource types
export type LearningResource = typeof learningResources.$inferSelect;
export type NewLearningResource = typeof learningResources.$inferInsert;

// Learning Resource Section types
export type LearningResourceSection = typeof learningResourceSections.$inferSelect;
export type NewLearningResourceSection = typeof learningResourceSections.$inferInsert;

// Skill-Resource link types
export type SkillResource = typeof skillResources.$inferSelect;
export type NewSkillResource = typeof skillResources.$inferInsert;

// Resource Embedding types
export type ResourceEmbedding = typeof resourceEmbeddings.$inferSelect;
export type NewResourceEmbedding = typeof resourceEmbeddings.$inferInsert;

// Embedding content type enum
export type EmbeddingContentType = 'resource' | 'description' | 'learning_objective' | 'section';

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

export type GoalResource = LearningResourceWithSections & {
  relevancePercentage: number;
  reasoning: string;
};
