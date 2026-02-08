import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, goals, learningResources, learningResourceSections, challenges as challengesTable } from '../../lib/db/schema';
import {
  challengesExistForGoal,
  getChallengesByGoalId,
  getChallengeById,
  getChallengeWithQuestions,
  updateChallengeStatus,
  claimChallengeForGeneration,
  addChallengeQuestions,
  getChallengeQuestion,
  resetFailedChallenge,
  unlockNextDifficulty,
  getChallengeGenerationStats,
  type NewChallengeQuestion
} from '../../lib/db/challengeRepository';

describe('challengeRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testResourceId: string;
  let testSectionId: string;
  let testSection2Id: string;
  let easyChallengeId: string;

  const sampleQuestions: NewChallengeQuestion[] = [
    {
      questionNumber: 1,
      question: 'What is TypeScript?',
      options: [
        { label: 'A', text: 'A superset of JavaScript' },
        { label: 'B', text: 'A database' },
        { label: 'C', text: 'A CSS framework' },
        { label: 'D', text: 'An OS' }
      ],
      correctAnswer: 'A',
      explanation: 'TypeScript extends JavaScript with types.',
      hint: 'Think about JavaScript'
    },
    {
      questionNumber: 2,
      question: 'What does TS compile to?',
      options: [
        { label: 'A', text: 'Python' },
        { label: 'B', text: 'JavaScript' },
        { label: 'C', text: 'Java' },
        { label: 'D', text: 'C++' }
      ],
      correctAnswer: 'B',
      explanation: 'TS compiles to JS.'
    }
  ];

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;

    const [goal] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Learn TypeScript', reasoning: 'Testing challenges' })
      .returning();
    testGoalId = goal.id;

    const [resource] = await db
      .insert(learningResources)
      .values({
        url: `https://test-challenge-repo-${Date.now()}.com`,
        title: 'TypeScript Course',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResourceId = resource.id;

    const [section1] = await db
      .insert(learningResourceSections)
      .values({ resourceId: testResourceId, title: 'Basics', orderIndex: 0, topics: ['types', 'interfaces'] })
      .returning();
    testSectionId = section1.id;

    const [section2] = await db
      .insert(learningResourceSections)
      .values({ resourceId: testResourceId, title: 'Advanced', orderIndex: 1, topics: ['generics'] })
      .returning();
    testSection2Id = section2.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(learningResources).where(eq(learningResources.id, testResourceId));
    await closeConnection();
  });

  it('creates challenges for goal (3 per section via direct insert)', async () => {
    const db = requireDb();
    const sections = [
      { id: testSectionId, title: 'Basics', topics: ['types', 'interfaces'] },
      { id: testSection2Id, title: 'Advanced', topics: ['generics'] }
    ];

    const difficulties = ['easy', 'medium', 'hard'] as const;
    const values = sections.flatMap((section) =>
      difficulties.map((difficulty) => ({
        goalId: testGoalId,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionTopics: section.topics,
        difficulty,
        status: difficulty === 'easy' ? ('pending' as const) : ('locked' as const),
        totalQuestions: 10
      }))
    );

    const result = await db.insert(challengesTable).values(values).returning();

    expect(result).toHaveLength(6); // 2 sections × 3 difficulties

    const easy = result.filter((c) => c.difficulty === 'easy');
    const medium = result.filter((c) => c.difficulty === 'medium');
    const hard = result.filter((c) => c.difficulty === 'hard');

    expect(easy).toHaveLength(2);
    expect(medium).toHaveLength(2);
    expect(hard).toHaveLength(2);

    easy.forEach((c) => expect(c.status).toBe('pending'));
    medium.forEach((c) => expect(c.status).toBe('locked'));
    hard.forEach((c) => expect(c.status).toBe('locked'));

    easyChallengeId = easy.find((c) => c.sectionId === testSectionId)!.id;
    mediumChallengeId = medium.find((c) => c.sectionId === testSectionId)!.id;
  });

  it('checks existence', async () => {
    const exists = await challengesExistForGoal(testGoalId);
    expect(exists).toBe(true);

    const notExists = await challengesExistForGoal('00000000-0000-0000-0000-000000000000');
    expect(notExists).toBe(false);
  });

  it('retrieves challenges by goal id', async () => {
    const result = await getChallengesByGoalId(testGoalId);

    expect(result).toHaveLength(6);
    result.forEach((c) => expect(c.goalId).toBe(testGoalId));
  });

  it('retrieves challenge by id', async () => {
    const result = await getChallengeById(easyChallengeId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(easyChallengeId);
    expect(result?.difficulty).toBe('easy');
    expect(result?.sectionTitle).toBe('Basics');
    expect(result?.sectionTopics).toEqual(['types', 'interfaces']);
  });

  it('adds questions with option normalization', async () => {
    const result = await addChallengeQuestions(easyChallengeId, sampleQuestions);

    expect(result).toHaveLength(2);
    expect(result[0].challengeId).toBe(easyChallengeId);
    expect(result[0].options).toHaveLength(4);
    expect(result[0].options[0].label).toBe('A');
    expect(result[1].hint).toBeNull();
  });

  it('retrieves challenge with questions', async () => {
    const result = await getChallengeWithQuestions(easyChallengeId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(easyChallengeId);
    expect(result?.questions).toHaveLength(2);
    // Ordered by questionNumber
    expect(result?.questions[0].questionNumber).toBe(1);
    expect(result?.questions[1].questionNumber).toBe(2);
  });

  it('retrieves a single question', async () => {
    const result = await getChallengeQuestion(easyChallengeId, 1);

    expect(result).toBeDefined();
    expect(result?.challengeId).toBe(easyChallengeId);
    expect(result?.questionNumber).toBe(1);
    expect(result?.question).toBe('What is TypeScript?');
    expect(result?.correctAnswer).toBe('A');
    expect(result?.hint).toBe('Think about JavaScript');
  });

  it('updates challenge status', async () => {
    const result = await updateChallengeStatus(easyChallengeId, 'complete');

    expect(result).toBeDefined();
    expect(result?.status).toBe('complete');
    expect(result?.errorMessage).toBeNull();
  });

  it('updates challenge status with error message', async () => {
    // First set to failed with error
    const result = await updateChallengeStatus(easyChallengeId, 'failed', 'Generation timed out');

    expect(result).toBeDefined();
    expect(result?.status).toBe('failed');
    expect(result?.errorMessage).toBe('Generation timed out');
  });

  it('claims challenge for generation (race guard)', async () => {
    // Reset to pending first
    await updateChallengeStatus(easyChallengeId, 'pending');

    const claimed = await claimChallengeForGeneration(easyChallengeId);

    expect(claimed).toBeDefined();
    expect(claimed?.status).toBe('generating');
  });

  it('claim returns undefined if already generating', async () => {
    // easyChallengeId is now 'generating' from the previous test
    const result = await claimChallengeForGeneration(easyChallengeId);

    expect(result).toBeUndefined();
  });

  it('resets failed challenge (transaction)', async () => {
    // Set to failed first
    await updateChallengeStatus(easyChallengeId, 'failed', 'Some error');

    const result = await resetFailedChallenge(easyChallengeId);

    expect(result).toBeDefined();
    expect(result?.status).toBe('pending');
    expect(result?.errorMessage).toBeNull();

    // Questions should be deleted
    const withQuestions = await getChallengeWithQuestions(easyChallengeId);
    expect(withQuestions?.questions).toHaveLength(0);
  });

  it('reset returns undefined for non-failed challenge', async () => {
    // easyChallengeId is now 'pending'
    const result = await resetFailedChallenge(easyChallengeId);

    expect(result).toBeUndefined();
  });

  it('unlocks next difficulty', async () => {
    // easy→medium
    const unlocked = await unlockNextDifficulty(testGoalId, testSectionId, 'easy');

    expect(unlocked).toBeDefined();
    expect(unlocked?.difficulty).toBe('medium');
    expect(unlocked?.status).toBe('pending');
    expect(unlocked?.sectionId).toBe(testSectionId);

    // medium→hard
    const unlockedHard = await unlockNextDifficulty(testGoalId, testSectionId, 'medium');

    expect(unlockedHard).toBeDefined();
    expect(unlockedHard?.difficulty).toBe('hard');
    expect(unlockedHard?.status).toBe('pending');

    // hard→null (no next)
    const noNext = await unlockNextDifficulty(testGoalId, testSectionId, 'hard');
    expect(noNext).toBeUndefined();
  });

  it('returns generation stats', async () => {
    const stats = await getChallengeGenerationStats(testGoalId);

    expect(stats.total).toBe(6);
    // We unlocked medium and hard for section1, section2 still has medium/hard locked
    // section1: easy=pending, medium=pending, hard=pending
    // section2: easy=pending, medium=locked, hard=locked
    expect(stats.total).toBe(6);
    expect(stats.locked).toBe(2);
    expect(stats.pending).toBe(4);
    expect(stats.generating).toBe(0);
    expect(stats.complete).toBe(0);
    expect(stats.failed).toBe(0);
  });
});
