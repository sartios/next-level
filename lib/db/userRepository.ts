import { eq } from 'drizzle-orm';
import { requireDb } from './index';
import { users } from './schema';

export interface User {
  id: string;
  role: string;
  skills: string[];
  careerGoals: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  role: string;
  skills: string[];
  careerGoals: string[];
}

/**
 * Insert a new user
 */
export async function insertUser(userData: NewUser): Promise<User> {
  const db = requireDb();
  const [inserted] = await db.insert(users).values(userData).returning();
  return inserted;
}

/**
 * Get a user by ID
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = requireDb();
  const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return results[0];
}

/**
 * Update a user
 */
export async function updateUser(id: string, userData: Partial<NewUser>): Promise<User | undefined> {
  const db = requireDb();
  const [updated] = await db
    .update(users)
    .set({ ...userData, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated;
}
