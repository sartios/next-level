import { eq, and } from 'drizzle-orm';
import { requireDb } from './index';
import { skills } from './schema';
import { Skill } from '../types';

// ============================================================================
// Skills
// ============================================================================

/**
 * Insert a skill or return existing one if it already exists
 */
export async function upsertSkill(name: string, career: string): Promise<Skill> {
  const db = requireDb();

  // Try to find existing skill
  const existing = await db
    .select()
    .from(skills)
    .where(and(eq(skills.name, name), eq(skills.career, career)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Insert new skill
  const [inserted] = await db.insert(skills).values({ name, career }).returning();

  return inserted;
}
