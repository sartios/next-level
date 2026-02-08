import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, learningResources } from '../../lib/db/schema';
import { insertGoal, getGoalById, getGoalsByUserId, updateGoal, updateGoalSelectedResource } from '../../lib/db/goalRepository';

describe('goalRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testResourceId: string;

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;

    const [resource] = await db
      .insert(learningResources)
      .values({
        url: `https://test-goal-repo-${Date.now()}.com`,
        title: 'Test Resource',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResourceId = resource.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(learningResources).where(eq(learningResources.id, testResourceId));
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

  it('retrieves goals by user id', async () => {
    const result = await getGoalsByUserId(testUserId);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].userId).toBe(testUserId);
  });

  it('returns empty array for user with no goals', async () => {
    const result = await getGoalsByUserId('00000000-0000-0000-0000-000000000000');

    expect(result).toEqual([]);
  });

  it('updates goal fields', async () => {
    const result = await updateGoal(testGoalId, {
      name: 'Master GraphQL',
      reasoning: 'Building production APIs'
    });

    expect(result).toBeDefined();
    expect(result?.name).toBe('Master GraphQL');
    expect(result?.reasoning).toBe('Building production APIs');
  });

  it('updates selected resource id', async () => {
    const result = await updateGoalSelectedResource(testGoalId, testResourceId);

    expect(result).toBeDefined();
    expect(result?.selectedResourceId).toBe(testResourceId);
  });
});
