import { pgTable, text, timestamp, integer, uuid, jsonb, index, vector, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Learning Resources System
// ============================================================================

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
    targetAudience: jsonb('target_audience').$type<string[]>().default([]),
    totalHours: real('total_hours'),
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
    orderIndex: integer('order_index').notNull(),
    topics: jsonb('topics').$type<string[]>().default([])
  },
  (table) => [index('learning_resource_sections_resource_id_idx').on(table.resourceId)]
);

// ============================================================================
// Resource Embeddings
// ============================================================================

/**
 * Embedding content type - defines what part of the resource the embedding represents
 */
export type EmbeddingContentType = 'resource' | 'description' | 'learning_objective' | 'target_audience' | 'section';

/**
 * Resource embeddings table - Stores embeddings for different content types
 * Uses content_type column to distinguish: resource, description, learning_objective, target_audience, section
 */
export const resourceEmbeddings = pgTable(
  'resource_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => learningResources.id, { onDelete: 'cascade' }),
    contentType: text('content_type').$type<EmbeddingContentType>().notNull(),
    contentIndex: integer('content_index'),
    sectionId: uuid('section_id').references(() => learningResourceSections.id, { onDelete: 'cascade' }),
    contentText: text('content_text').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('resource_embeddings_resource_id_idx').on(table.resourceId),
    index('resource_embeddings_content_type_idx').on(table.contentType),
    index('resource_embeddings_section_id_idx').on(table.sectionId)
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const learningResourcesRelations = relations(learningResources, ({ many }) => ({
  sections: many(learningResourceSections),
  embeddings: many(resourceEmbeddings)
}));

export const learningResourceSectionsRelations = relations(learningResourceSections, ({ one, many }) => ({
  resource: one(learningResources, {
    fields: [learningResourceSections.resourceId],
    references: [learningResources.id]
  }),
  embeddings: many(resourceEmbeddings)
}));

export const resourceEmbeddingsRelations = relations(resourceEmbeddings, ({ one }) => ({
  resource: one(learningResources, {
    fields: [resourceEmbeddings.resourceId],
    references: [learningResources.id]
  }),
  section: one(learningResourceSections, {
    fields: [resourceEmbeddings.sectionId],
    references: [learningResourceSections.id]
  })
}));
