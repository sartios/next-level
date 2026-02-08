import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users } from '../../lib/db/schema';
import { insertGoal, getGoalById } from '../../lib/db/goalRepository';

describe('goalRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await closeConnection();
  });

  it('inserts a goal', async () => {
    const result = await insertGoal({
      userId: testUserId,
      name: 'Learn GraphQL',
      reasoning: 'Need for API work'
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Learn GraphQL');
    expect(result.userId).toBe(testUserId);
    expect(result.selectedResourceId).toBeNull();

    testGoalId = result.id;
  });

  it('retrieves goal by id', async () => {
    const result = await getGoalById(testGoalId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(testGoalId);
    expect(result?.name).toBe('Learn GraphQL');
  });

  it('returns undefined for non-existent id', async () => {
    const result = await getGoalById('00000000-0000-0000-0000-000000000000');

    expect(result).toBeUndefined();
  });
});
