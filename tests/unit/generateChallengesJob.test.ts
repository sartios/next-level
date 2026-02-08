import { describe, it, expect, vi, beforeEach } from 'vitest';

let jobPromise: Promise<void>;

vi.mock('next/server', () => ({
  after: vi.fn((fn: () => Promise<void>) => {
    jobPromise = fn();
  })
}));
vi.mock('@/lib/db/userRepository', () => ({ getUserById: vi.fn() }));
vi.mock('@/lib/db/goalRepository', () => ({ getGoalById: vi.fn() }));
vi.mock('@/lib/db/resourceRepository', () => ({ getLearningResourceWithSections: vi.fn() }));
vi.mock('@/lib/db/challengeRepository', () => ({
  getChallengesByGoalId: vi.fn(),
  claimChallengeForGeneration: vi.fn()
}));
vi.mock('@/lib/agents/ChallengeGeneratorAgent', () => ({
  generateAllChallengesForGoal: vi.fn()
}));

import { after } from 'next/server';
import { getUserById } from '@/lib/db/userRepository';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { getChallengesByGoalId, claimChallengeForGeneration } from '@/lib/db/challengeRepository';
import { generateAllChallengesForGoal } from '@/lib/agents/ChallengeGeneratorAgent';
import { startGenerateChallengesJob } from '@/lib/jobs/generateChallengesJob';
import { makeUser, makeGoal, makeResource, makeChallenge } from '../helpers/agentTestHarness';

const mockAfter = vi.mocked(after);
const mockGetUserById = vi.mocked(getUserById);
const mockGetGoalById = vi.mocked(getGoalById);
const mockGetLearningResourceWithSections = vi.mocked(getLearningResourceWithSections);
const mockGetChallengesByGoalId = vi.mocked(getChallengesByGoalId);
const mockClaimChallengeForGeneration = vi.mocked(claimChallengeForGeneration);
const mockGenerateAllChallengesForGoal = vi.mocked(generateAllChallengesForGoal);

const userId = 'user-1';
const goalId = 'goal-1';
const resourceId = 'resource-1';

const testUser = makeUser({ id: userId });
const testGoal = makeGoal({ id: goalId, selectedResourceId: resourceId });
const testResource = makeResource(resourceId, 'Test Resource');

describe('generateChallengesJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call after() with the job function', () => {
    mockGetUserById.mockResolvedValue(undefined);
    startGenerateChallengesJob(userId, goalId);
    expect(mockAfter).toHaveBeenCalledOnce();
  });

  it('should return early if user not found', async () => {
    mockGetUserById.mockResolvedValue(undefined);

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockGetUserById).toHaveBeenCalledWith(userId);
    expect(mockGetGoalById).not.toHaveBeenCalled();
  });

  it('should return early if goal not found', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(undefined);

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockGetGoalById).toHaveBeenCalledWith(goalId);
    expect(mockGetLearningResourceWithSections).not.toHaveBeenCalled();
  });

  it('should return early if goal has no selected resource', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(makeGoal({ id: goalId, selectedResourceId: null }));

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockGetLearningResourceWithSections).not.toHaveBeenCalled();
  });

  it('should return early if resource not found', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(undefined);

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockGetLearningResourceWithSections).toHaveBeenCalledWith(resourceId);
    expect(mockGetChallengesByGoalId).not.toHaveBeenCalled();
  });

  it('should return early if no pending challenges', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(testResource);
    mockGetChallengesByGoalId.mockResolvedValue([makeChallenge({ id: 'c1', status: 'complete' })]);

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockClaimChallengeForGeneration).not.toHaveBeenCalled();
  });

  it('should return early if no challenges are claimed', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(testResource);
    mockGetChallengesByGoalId.mockResolvedValue([makeChallenge({ id: 'c1', status: 'pending' })]);
    mockClaimChallengeForGeneration.mockResolvedValue(undefined);

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockClaimChallengeForGeneration).toHaveBeenCalledWith('c1');
    expect(mockGenerateAllChallengesForGoal).not.toHaveBeenCalled();
  });

  it('should generate challenges for claimed pending challenges', async () => {
    const pendingChallenges = [
      makeChallenge({ id: 'c1', status: 'pending' }),
      makeChallenge({ id: 'c2', status: 'pending' })
    ];
    const claimedChallenges = [
      makeChallenge({ id: 'c1', status: 'generating' }),
      makeChallenge({ id: 'c2', status: 'generating' })
    ];

    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(testResource);
    mockGetChallengesByGoalId.mockResolvedValue(pendingChallenges);
    mockClaimChallengeForGeneration
      .mockResolvedValueOnce(claimedChallenges[0])
      .mockResolvedValueOnce(claimedChallenges[1]);
    mockGenerateAllChallengesForGoal.mockResolvedValue({ success: 2, failed: 0 });

    startGenerateChallengesJob(userId, goalId, 'test-op');
    await jobPromise;

    expect(mockGenerateAllChallengesForGoal).toHaveBeenCalledWith(
      testUser,
      testGoal,
      testResource,
      claimedChallenges,
      'test-op'
    );
  });

  it('should only claim pending challenges, not completed ones', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(testResource);
    mockGetChallengesByGoalId.mockResolvedValue([
      makeChallenge({ id: 'c1', status: 'pending' }),
      makeChallenge({ id: 'c2', status: 'complete' }),
      makeChallenge({ id: 'c3', status: 'pending' })
    ]);
    mockClaimChallengeForGeneration
      .mockResolvedValueOnce(makeChallenge({ id: 'c1', status: 'generating' }))
      .mockResolvedValueOnce(makeChallenge({ id: 'c3', status: 'generating' }));
    mockGenerateAllChallengesForGoal.mockResolvedValue({ success: 2, failed: 0 });

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    expect(mockClaimChallengeForGeneration).toHaveBeenCalledTimes(2);
    expect(mockClaimChallengeForGeneration).toHaveBeenCalledWith('c1');
    expect(mockClaimChallengeForGeneration).toHaveBeenCalledWith('c3');
  });

  it('should not throw when agent throws an error', async () => {
    mockGetUserById.mockResolvedValue(testUser);
    mockGetGoalById.mockResolvedValue(testGoal);
    mockGetLearningResourceWithSections.mockResolvedValue(testResource);
    mockGetChallengesByGoalId.mockResolvedValue([makeChallenge({ id: 'c1', status: 'pending' })]);
    mockClaimChallengeForGeneration.mockResolvedValue(makeChallenge({ id: 'c1', status: 'generating' }));
    mockGenerateAllChallengesForGoal.mockRejectedValue(new Error('Agent failed'));

    startGenerateChallengesJob(userId, goalId);
    await jobPromise;

    // Error is caught internally — no throw
    expect(mockGenerateAllChallengesForGoal).toHaveBeenCalled();
  });
});
