import { eq } from 'drizzle-orm';
import { requireDb } from './index';
import { goals } from './schema';

export interface Goal {
  id: string;
  userId: string;
  name: string;
  reasoning: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewGoal {
  userId: string;
  name: string;
  reasoning: string;
}

/**
 * Insert a new goal
 */
export async function insertGoal(goalData: NewGoal): Promise<Goal> {
  const db = requireDb();
  const [inserted] = await db.insert(goals).values(goalData).returning();
  return inserted;
}

/**
 * Get a goal by ID
 */
export async function getGoalById(id: string): Promise<Goal | undefined> {
  const db = requireDb();
  const results = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
  return results[0];
}

/**
 * Get goals by user ID
 */
export async function getGoalsByUserId(userId: string): Promise<Goal[]> {
  const db = requireDb();
  return db.select().from(goals).where(eq(goals.userId, userId));
}

/**
 * Update a goal
 */
export async function updateGoal(id: string, goalData: Partial<Omit<NewGoal, 'userId'>>): Promise<Goal | undefined> {
  const db = requireDb();
  const [updated] = await db
    .update(goals)
    .set({ ...goalData, updatedAt: new Date() })
    .where(eq(goals.id, id))
    .returning();
  return updated;
}
