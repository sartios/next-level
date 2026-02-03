import { pgTable, text, timestamp, integer, uuid, jsonb, index, vector, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Users
// ============================================================================

/**
 * Users table - Stores user profiles for the learning platform
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: text('role').notNull(),
    skills: jsonb('skills').$type<string[]>().default([]).notNull(),
    careerGoals: jsonb('career_goals').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [index('users_created_at_idx').on(table.createdAt)]
);

// ============================================================================
// Goals
// ============================================================================

/**
 * Goals table - Stores user learning goals
 */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    reasoning: text('reasoning').notNull(),
    selectedResourceId: uuid('selected_resource_id').references(() => learningResources.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [index('goals_user_id_idx').on(table.userId)]
);

// ============================================================================
// Schedules
// ============================================================================

/**
 * Day of week type for schedule slots
 */
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/**
 * User schedules table - Stores weekly availability for a user's learning goal
 */
export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    startDate: timestamp('start_date').notNull(),
    weeklyHours: real('weekly_hours').notNull(),
    targetCompletionDate: timestamp('target_completion_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('schedules_user_id_idx').on(table.userId),
    index('schedules_goal_id_idx').on(table.goalId)
  ]
);

/**
 * Schedule slots table - Individual time slots within a schedule
 */
export const scheduleSlots = pgTable(
  'schedule_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    dayOfWeek: text('day_of_week').$type<DayOfWeek>().notNull(),
    startTime: text('start_time').notNull(), // Format: "HH:MM"
    endTime: text('end_time').notNull(), // Format: "HH:MM"
    durationMinutes: integer('duration_minutes').notNull()
  },
  (table) => [index('schedule_slots_schedule_id_idx').on(table.scheduleId)]
);

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

export const usersRelations = relations(users, ({ many }) => ({
  goals: many(goals),
  schedules: many(schedules)
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id]
  }),
  selectedResource: one(learningResources, {
    fields: [goals.selectedResourceId],
    references: [learningResources.id]
  }),
  schedules: many(schedules)
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  user: one(users, {
    fields: [schedules.userId],
    references: [users.id]
  }),
  goal: one(goals, {
    fields: [schedules.goalId],
    references: [goals.id]
  }),
  slots: many(scheduleSlots)
}));

export const scheduleSlotsRelations = relations(scheduleSlots, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduleSlots.scheduleId],
    references: [schedules.id]
  })
}));
