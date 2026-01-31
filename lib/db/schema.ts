import { pgTable, text, timestamp, integer, uuid, jsonb, index, vector, decimal, unique } from 'drizzle-orm/pg-core';

// ============================================================================
// Learning Resources System
// ============================================================================

/**
 * Skills table - Career skills that can be learned
 */
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    career: text('career').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    unique('skills_name_career_unique').on(table.name, table.career),
    index('skills_name_idx').on(table.name),
    index('skills_career_idx').on(table.career)
  ]
);

/**
 * Learning resources table - Courses, books, tutorials, articles, etc.
 * Note: Embeddings are stored in the separate resource_embeddings table
 * to enable granular similarity search at multiple levels.
 */
export const learningResources = pgTable(
  'learning_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    provider: text('provider').notNull(),
    resourceType: text('resource_type').$type<'course' | 'book' | 'tutorial' | 'article'>().notNull(),
    learningObjectives: jsonb('learning_objectives').$type<string[]>().default([]),
    totalHours: decimal('total_hours', { precision: 6, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('learning_resources_url_idx').on(table.url),
    index('learning_resources_provider_idx').on(table.provider),
    index('learning_resources_resource_type_idx').on(table.resourceType)
  ]
);

/**
 * Learning resource sections - Chapters/modules within a resource
 */
export const learningResourceSections = pgTable(
  'learning_resource_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => learningResources.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    estimatedMinutes: integer('estimated_minutes'),
    orderIndex: integer('order_index').notNull()
  },
  (table) => [index('learning_resource_sections_resource_id_idx').on(table.resourceId)]
);

/**
 * Skill resources - Links skills to resources with proficiency levels
 */
export const skillResources = pgTable(
  'skill_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => learningResources.id, { onDelete: 'cascade' }),
    level: text('level').$type<'beginner' | 'intermediate' | 'expert'>().notNull()
  },
  (table) => [
    unique('skill_resources_unique').on(table.skillId, table.resourceId, table.level),
    index('skill_resources_skill_id_idx').on(table.skillId),
    index('skill_resources_resource_id_idx').on(table.resourceId),
    index('skill_resources_level_idx').on(table.level)
  ]
);

/**
 * Embedding content types for granular similarity search:
 * - 'resource': Full resource (title + description + objectives combined)
 * - 'description': Just the resource description
 * - 'learning_objective': Individual learning objective
 * - 'section': Individual section/chapter title
 */
export type EmbeddingContentType = 'resource' | 'description' | 'learning_objective' | 'section';

/**
 * Resource embeddings table - Stores embeddings for different content types
 * Enables similarity search at resource, description, objective, or section level
 */
export const resourceEmbeddings = pgTable(
  'resource_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => learningResources.id, { onDelete: 'cascade' }),
    contentType: text('content_type').$type<EmbeddingContentType>().notNull(),
    // For learning_objectives and sections, which item (0-indexed)
    contentIndex: integer('content_index'),
    // Optional reference to section (when contentType is 'section')
    sectionId: uuid('section_id').references(() => learningResourceSections.id, { onDelete: 'cascade' }),
    // The actual text that was embedded (for display in search results)
    contentText: text('content_text').notNull(),
    // The embedding vector
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('resource_embeddings_resource_id_idx').on(table.resourceId),
    index('resource_embeddings_content_type_idx').on(table.contentType),
    index('resource_embeddings_section_id_idx').on(table.sectionId)
  ]
);

// Type exports for learning resources
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type LearningResource = typeof learningResources.$inferSelect;
export type NewLearningResource = typeof learningResources.$inferInsert;
export type LearningResourceSection = typeof learningResourceSections.$inferSelect;
export type NewLearningResourceSection = typeof learningResourceSections.$inferInsert;
export type SkillResource = typeof skillResources.$inferSelect;
export type NewSkillResource = typeof skillResources.$inferInsert;
export type ResourceEmbedding = typeof resourceEmbeddings.$inferSelect;
export type NewResourceEmbedding = typeof resourceEmbeddings.$inferInsert;
