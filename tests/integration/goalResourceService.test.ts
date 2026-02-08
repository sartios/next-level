import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, goals, learningResources, learningResourceSections } from '../../lib/db/schema';
import { selectResourceAndCreateChallenges } from '../../lib/db/goalResourceService';
import { getChallengesByGoalId } from '../../lib/db/challengeRepository';

describe('goalResourceService integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testGoal2Id: string;
  let testGoal3Id: string;
  let testResourceId: string;
  let testResource2Id: string;
  let testResource3Id: string;
  let testSection1Id: string;
  let testSection2Id: string;

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;

    // Goal with 2 sections
    const [goal] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Learn React', reasoning: 'Testing service' })
      .returning();
    testGoalId = goal.id;

    // Goal for null sections test
    const [goal2] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Learn Vue', reasoning: 'Testing null sections' })
      .returning();
    testGoal2Id = goal2.id;

    // Goal for empty sections test
    const [goal3] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Learn Angular', reasoning: 'Testing empty sections' })
      .returning();
    testGoal3Id = goal3.id;

    // Resource with 2 sections
    const [resource] = await db
      .insert(learningResources)
      .values({
        url: `https://test-goal-resource-svc-${Date.now()}.com`,
        title: 'React Course',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResourceId = resource.id;

    const [section1] = await db
      .insert(learningResourceSections)
      .values({ resourceId: testResourceId, title: 'JSX Basics', orderIndex: 0, topics: ['jsx', 'components'] })
      .returning();
    testSection1Id = section1.id;

    const [section2] = await db
      .insert(learningResourceSections)
      .values({ resourceId: testResourceId, title: 'Hooks', orderIndex: 1, topics: ['useState', 'useEffect'] })
      .returning();
    testSection2Id = section2.id;

    // Resource for null sections test
    const [resource2] = await db
      .insert(learningResources)
      .values({
        url: `https://test-goal-resource-svc2-${Date.now()}.com`,
        title: 'Vue Course',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResource2Id = resource2.id;

    // Resource for empty sections test
    const [resource3] = await db
      .insert(learningResources)
      .values({
        url: `https://test-goal-resource-svc3-${Date.now()}.com`,
        title: 'Angular Course',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResource3Id = resource3.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(learningResources).where(eq(learningResources.id, testResourceId));
    await db.delete(learningResources).where(eq(learningResources.id, testResource2Id));
    await db.delete(learningResources).where(eq(learningResources.id, testResource3Id));
    await closeConnection();
  });

  it('selects resource and creates challenges', async () => {
    const sections = [
      { id: testSection1Id, title: 'JSX Basics', topics: ['jsx', 'components'] },
      { id: testSection2Id, title: 'Hooks', topics: ['useState', 'useEffect'] }
    ];

    const result = await selectResourceAndCreateChallenges(testGoalId, testResourceId, sections);

    expect(result).toBeDefined();
    expect(result.id).toBe(testGoalId);
    expect(result.selectedResourceId).toBe(testResourceId);

    // Verify challenges were created (detailed status assertions in challengeRepository tests)
    const createdChallenges = await getChallengesByGoalId(testGoalId);
    expect(createdChallenges).toHaveLength(6); // 2 sections × 3 difficulties
  });

  it('creates no challenges when sections is null', async () => {
    const result = await selectResourceAndCreateChallenges(testGoal2Id, testResource2Id, null);

    expect(result).toBeDefined();
    expect(result.selectedResourceId).toBe(testResource2Id);

    const createdChallenges = await getChallengesByGoalId(testGoal2Id);
    expect(createdChallenges).toHaveLength(0);
  });

  it('creates no challenges when sections is empty', async () => {
    const result = await selectResourceAndCreateChallenges(testGoal3Id, testResource3Id, []);

    expect(result).toBeDefined();
    expect(result.selectedResourceId).toBe(testResource3Id);

    const createdChallenges = await getChallengesByGoalId(testGoal3Id);
    expect(createdChallenges).toHaveLength(0);
  });

  it('throws when goal update fails', async () => {
    await expect(
      selectResourceAndCreateChallenges('00000000-0000-0000-0000-000000000000', testResourceId, [])
    ).rejects.toThrow('Failed to update goal');
  });
});
