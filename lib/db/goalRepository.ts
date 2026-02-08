import { eq } from 'drizzle-orm';
import { requireDb } from './index';
import { goals } from './schema';

export interface Goal {
  id: string;
  userId: string;
  name: string;
  reasoning: string;
  selectedResourceId: string | null;
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
