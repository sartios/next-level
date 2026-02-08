import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users, goals, learningResources, learningResourceSections, challenges, challengeQuestions } from '../../lib/db/schema';
import {
  getOrCreateProgress,
  recordAnswer,
  markComplete,
  resetProgress,
  getProgressForChallenges
} from '../../lib/db/challengeProgressRepository';

describe('challengeProgressRepository integration tests', () => {
  let testUserId: string;
  let testGoalId: string;
  let testResourceId: string;
  let testChallengeId: string;
  let testChallenge2Id: string;
  const visitorId = `test-visitor-${Date.now()}`;

  beforeAll(async () => {
    const db = requireDb();

    const [user] = await db
      .insert(users)
      .values({ role: 'test-user', skills: ['testing'], careerGoals: ['learn testing'] })
      .returning();
    testUserId = user.id;

    const [goal] = await db
      .insert(goals)
      .values({ userId: testUserId, name: 'Learn Testing', reasoning: 'Testing progress' })
      .returning();
    testGoalId = goal.id;

    const [resource] = await db
      .insert(learningResources)
      .values({
        url: `https://test-progress-repo-${Date.now()}.com`,
        title: 'Testing Course',
        provider: 'TestProvider',
        resourceType: 'course'
      })
      .returning();
    testResourceId = resource.id;

    const [section] = await db
      .insert(learningResourceSections)
      .values({ resourceId: testResourceId, title: 'Basics', orderIndex: 0, topics: ['unit-tests'] })
      .returning();

    // Create a challenge with status 'complete' and questions
    const [challenge] = await db
      .insert(challenges)
      .values({
        goalId: testGoalId,
        sectionId: section.id,
        sectionTitle: 'Basics',
        sectionTopics: ['unit-tests'],
        difficulty: 'easy',
        status: 'complete',
        totalQuestions: 2
      })
      .returning();
    testChallengeId = challenge.id;

    // Add questions to the challenge
    await db.insert(challengeQuestions).values([
      {
        challengeId: testChallengeId,
        questionNumber: 1,
        question: 'What is a unit test?',
        options: [
          { label: 'A', text: 'A test for a single unit' },
          { label: 'B', text: 'A database test' },
          { label: 'C', text: 'A load test' },
          { label: 'D', text: 'A manual test' }
        ],
        correctAnswer: 'A',
        explanation: 'Unit tests test individual units.'
      },
      {
        challengeId: testChallengeId,
        questionNumber: 2,
        question: 'Which framework for JS testing?',
        options: [
          { label: 'A', text: 'JUnit' },
          { label: 'B', text: 'pytest' },
          { label: 'C', text: 'Vitest' },
          { label: 'D', text: 'NUnit' }
        ],
        correctAnswer: 'C',
        explanation: 'Vitest is a JS testing framework.'
      }
    ]);

    // Create a second challenge for batch lookup tests
    const [challenge2] = await db
      .insert(challenges)
      .values({
        goalId: testGoalId,
        sectionId: section.id,
        sectionTitle: 'Basics',
        sectionTopics: ['unit-tests'],
        difficulty: 'medium',
        status: 'complete',
        totalQuestions: 2
      })
      .returning();
    testChallenge2Id = challenge2.id;
  });

  afterAll(async () => {
    const db = requireDb();
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(learningResources).where(eq(learningResources.id, testResourceId));
    await closeConnection();
  });

  it('creates progress on first access', async () => {
    const result = await getOrCreateProgress(testChallengeId, visitorId);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.challengeId).toBe(testChallengeId);
    expect(result.visitorId).toBe(visitorId);
    expect(result.currentQuestionIndex).toBe(0);
    expect(result.answers).toEqual({});
    expect(result.correctAnswers).toBe(0);
    expect(result.earnedPoints).toBe(0);
    expect(result.status).toBe('not_started');
    expect(result.completedAt).toBeNull();
  });

  it('returns existing progress on second call', async () => {
    const first = await getOrCreateProgress(testChallengeId, visitorId);
    const second = await getOrCreateProgress(testChallengeId, visitorId);

    expect(second.id).toBe(first.id);
    expect(second.challengeId).toBe(first.challengeId);
  });

  it('records an answer', async () => {
    const result = await recordAnswer(testChallengeId, visitorId, {
      questionNumber: 1,
      answer: 'A',
      isCorrect: true,
      points: 10
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('in_progress');
    expect(result.correctAnswers).toBe(1);
    expect(result.earnedPoints).toBe(10);
    expect(result.answers[1]).toEqual({ answer: 'A', isCorrect: true });
  });

  it('records multiple answers', async () => {
    const result = await recordAnswer(testChallengeId, visitorId, {
      questionNumber: 2,
      answer: 'B',
      isCorrect: false,
      points: 0
    });

    expect(result).toBeDefined();
    expect(result.correctAnswers).toBe(1); // Still 1 from previous
    expect(result.earnedPoints).toBe(10); // Still 10
    expect(result.answers[1]).toEqual({ answer: 'A', isCorrect: true });
    expect(result.answers[2]).toEqual({ answer: 'B', isCorrect: false });
  });

  it('marks complete', async () => {
    const result = await markComplete(testChallengeId, visitorId, 1, 10);

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.correctAnswers).toBe(1);
    expect(result.earnedPoints).toBe(10);
    expect(result.completedAt).toBeDefined();
    expect(result.completedAt).not.toBeNull();
  });

  it('resets progress', async () => {
    const result = await resetProgress(testChallengeId, visitorId);

    expect(result).toBeDefined();
    expect(result.status).toBe('not_started');
    expect(result.currentQuestionIndex).toBe(0);
    expect(result.answers).toEqual({});
    expect(result.correctAnswers).toBe(0);
    expect(result.earnedPoints).toBe(0);
    expect(result.completedAt).toBeNull();
  });

  it('batch lookup returns progress map', async () => {
    // Record an answer on challenge1 so it has progress
    await recordAnswer(testChallengeId, visitorId, {
      questionNumber: 1,
      answer: 'A',
      isCorrect: true,
      points: 10
    });

    const result = await getProgressForChallenges([testChallengeId, testChallenge2Id], visitorId);

    // challenge1 has progress, challenge2 does not (no progress record created)
    expect(result[testChallengeId]).toBeDefined();
    expect(result[testChallengeId].hasProgress).toBe(true);
    expect(result[testChallengeId].answeredCount).toBe(1);
    expect(result[testChallengeId].status).toBe('in_progress');

    // challenge2 has no progress record at all
    expect(result[testChallenge2Id]).toBeUndefined();
  });

  it('batch lookup with empty array', async () => {
    const result = await getProgressForChallenges([], visitorId);

    expect(result).toEqual({});
  });
});
