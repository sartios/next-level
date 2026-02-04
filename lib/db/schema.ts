import { pgTable, text, timestamp, integer, uuid, jsonb, index, uniqueIndex, vector, real } from 'drizzle-orm/pg-core';
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
  (table) => [index('schedules_user_id_idx').on(table.userId), index('schedules_goal_id_idx').on(table.goalId)]
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
// Weekly Plans
// ============================================================================

/**
 * Plan session status type
 */
export type PlanSessionStatus = 'pending' | 'in_progress' | 'completed' | 'missed';

/**
 * Weekly plans table - Stores weekly learning plans for a goal
 * Each goal can have multiple weekly plans (one per week)
 */
export const weeklyPlans = pgTable(
  'weekly_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    weekNumber: integer('week_number').notNull(),
    weekStartDate: timestamp('week_start_date').notNull(),
    focusArea: text('focus_area').notNull(),
    totalMinutes: integer('total_minutes').notNull(),
    completionPercentage: integer('completion_percentage').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('weekly_plans_goal_id_idx').on(table.goalId),
    index('weekly_plans_week_start_date_idx').on(table.weekStartDate),
    uniqueIndex('weekly_plans_goal_week_unique').on(table.goalId, table.weekNumber)
  ]
);

/**
 * Plan sessions table - Individual learning sessions within a weekly plan
 */
export const planSessions = pgTable(
  'plan_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weeklyPlanId: uuid('weekly_plan_id')
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
    dayOfWeek: text('day_of_week').$type<DayOfWeek>().notNull(),
    startTime: text('start_time').notNull(), // Format: "HH:MM"
    endTime: text('end_time').notNull(), // Format: "HH:MM"
    durationMinutes: integer('duration_minutes').notNull(),
    topic: text('topic').notNull(),
    activities: jsonb('activities').$type<string[]>().default([]).notNull(),
    status: text('status').$type<PlanSessionStatus>().default('pending').notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [index('plan_sessions_weekly_plan_id_idx').on(table.weeklyPlanId), index('plan_sessions_status_idx').on(table.status)]
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
// Challenges
// ============================================================================

/**
 * Challenge difficulty type
 */
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Challenge status type
 * - locked: Challenge exists but cannot be started yet (requires previous difficulty completion)
 * - pending: Ready to have questions generated
 * - generating: Questions are being generated
 * - complete: Questions generated and ready to play
 * - failed: Question generation failed
 */
export type ChallengeStatus = 'locked' | 'pending' | 'generating' | 'complete' | 'failed';

/**
 * Challenge progress status
 * - not_started: Progress record exists but no questions answered
 * - in_progress: User has started answering questions
 * - completed: User has finished the challenge
 */
export type ChallengeProgressStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Challenges table - Stores challenge metadata per resource section
 * These are created when a goal selects a resource, and questions are generated in background
 */
export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => learningResourceSections.id, { onDelete: 'cascade' }),
    sectionTitle: text('section_title').notNull(),
    sectionTopics: jsonb('section_topics').$type<string[]>().default([]),
    difficulty: text('difficulty').$type<ChallengeDifficulty>().default('easy').notNull(),
    status: text('status').$type<ChallengeStatus>().default('pending').notNull(),
    totalQuestions: integer('total_questions').default(10).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('challenges_goal_id_idx').on(table.goalId),
    index('challenges_section_id_idx').on(table.sectionId),
    index('challenges_status_idx').on(table.status),
    uniqueIndex('challenges_goal_section_difficulty_unique').on(table.goalId, table.sectionId, table.difficulty)
  ]
);

/**
 * Challenge questions table - Stores the questions for challenges
 */
export const challengeQuestions = pgTable(
  'challenge_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    questionNumber: integer('question_number').notNull(),
    question: text('question').notNull(),
    options: jsonb('options').$type<{ label: string; text: string }[]>().notNull(),
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation').notNull(),
    hint: text('hint'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('challenge_questions_challenge_id_idx').on(table.challengeId),
    uniqueIndex('challenge_questions_challenge_number_unique').on(table.challengeId, table.questionNumber)
  ]
);

/**
 * Challenge progress table - Tracks user's progress on a challenge
 * Allows resuming from where they left off
 */
export const challengeProgress = pgTable(
  'challenge_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    visitorId: text('visitor_id').notNull(),
    currentQuestionIndex: integer('current_question_index').default(0).notNull(),
    // Store answers as JSON: { questionNumber: { answer: string, isCorrect: boolean } }
    answers: jsonb('answers').$type<Record<number, { answer: string; isCorrect: boolean }>>().default({}).notNull(),
    correctAnswers: integer('correct_answers').default(0).notNull(),
    earnedPoints: integer('earned_points').default(0).notNull(),
    status: text('status').$type<ChallengeProgressStatus>().default('not_started').notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at')
  },
  (table) => [
    index('challenge_progress_challenge_id_idx').on(table.challengeId),
    index('challenge_progress_visitor_id_idx').on(table.visitorId),
    // One progress record per challenge per visitor
    uniqueIndex('challenge_progress_challenge_visitor_unique').on(table.challengeId, table.visitorId)
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
  schedules: many(schedules),
  weeklyPlans: many(weeklyPlans),
  challenges: many(challenges)
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

export const weeklyPlansRelations = relations(weeklyPlans, ({ one, many }) => ({
  goal: one(goals, {
    fields: [weeklyPlans.goalId],
    references: [goals.id]
  }),
  sessions: many(planSessions)
}));

export const planSessionsRelations = relations(planSessions, ({ one }) => ({
  weeklyPlan: one(weeklyPlans, {
    fields: [planSessions.weeklyPlanId],
    references: [weeklyPlans.id]
  })
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  goal: one(goals, {
    fields: [challenges.goalId],
    references: [goals.id]
  }),
  section: one(learningResourceSections, {
    fields: [challenges.sectionId],
    references: [learningResourceSections.id]
  }),
  questions: many(challengeQuestions),
  progress: many(challengeProgress)
}));

export const challengeQuestionsRelations = relations(challengeQuestions, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeQuestions.challengeId],
    references: [challenges.id]
  })
}));

export const challengeProgressRelations = relations(challengeProgress, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeProgress.challengeId],
    references: [challenges.id]
  })
}));
