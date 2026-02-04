import { after } from 'next/server';
import { getUserById } from '@/lib/db/userRepository';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { getChallengesByGoalId, updateChallengeStatus } from '@/lib/db/challengeRepository';
import { generateAllChallengesForGoal } from '@/lib/agents/ChallengeGeneratorAgent';

/**
 * Background job to generate all challenges for a goal.
 * This function runs independently of the request lifecycle.
 */
async function runGenerateChallengesJob(userId: string, goalId: string): Promise<void> {
  console.log(`[ChallengeJob] Starting challenge generation for goal ${goalId}`);

  try {
    // Get user
    const user = await getUserById(userId);
    if (!user) {
      console.error(`[ChallengeJob] User ${userId} not found`);
      return;
    }

    // Get goal
    const goal = await getGoalById(goalId);
    if (!goal) {
      console.error(`[ChallengeJob] Goal ${goalId} not found`);
      return;
    }

    // Get resource
    if (!goal.selectedResourceId) {
      console.error(`[ChallengeJob] No resource selected for goal ${goalId}`);
      return;
    }

    const resource = await getLearningResourceWithSections(goal.selectedResourceId);
    if (!resource) {
      console.error(`[ChallengeJob] Resource ${goal.selectedResourceId} not found`);
      return;
    }

    // Get pending challenges
    const challenges = await getChallengesByGoalId(goalId);
    const pendingChallenges = challenges.filter((c) => c.status === 'pending');

    if (pendingChallenges.length === 0) {
      console.log(`[ChallengeJob] No pending challenges for goal ${goalId}`);
      return;
    }

    console.log(`[ChallengeJob] Generating ${pendingChallenges.length} challenges for goal ${goalId}`);

    // Mark all as generating
    for (const challenge of pendingChallenges) {
      await updateChallengeStatus(challenge.id, 'generating');
    }

    // Generate challenges
    const result = await generateAllChallengesForGoal(user, goal, resource, pendingChallenges);

    console.log(`[ChallengeJob] Completed for goal ${goalId}: ${result.success} success, ${result.failed} failed`);
  } catch (error) {
    console.error(`[ChallengeJob] Error generating challenges for goal ${goalId}:`, error);
  }
}

/**
 * Starts the challenge generation job in the background.
 * Uses Next.js `after()` API to ensure the job runs to completion
 * even after the HTTP response is sent.
 */
export function startGenerateChallengesJob(userId: string, goalId: string): void {
  after(async () => {
    await runGenerateChallengesJob(userId, goalId);
  });
}
