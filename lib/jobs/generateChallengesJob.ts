import { after } from 'next/server';
import { getUserById } from '@/lib/db/userRepository';
import { getGoalById } from '@/lib/db/goalRepository';
import { getLearningResourceWithSections } from '@/lib/db/resourceRepository';
import { getChallengesByGoalId, claimChallengeForGeneration } from '@/lib/db/challengeRepository';
import { generateAllChallengesForGoal } from '@/lib/agents/ChallengeGeneratorAgent';

/**
 * Background job to generate all challenges for a goal.
 * This function runs independently of the request lifecycle.
 */
async function runGenerateChallengesJob(userId: string, goalId: string, operation?: string): Promise<void> {
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

    // Atomically claim challenges for generation (prevents race conditions)
    const claimedChallenges = [];
    for (const challenge of pendingChallenges) {
      const claimed = await claimChallengeForGeneration(challenge.id);
      if (claimed) {
        claimedChallenges.push(claimed);
      }
    }

    if (claimedChallenges.length === 0) {
      console.log(`[ChallengeJob] No challenges claimed for goal ${goalId} (already being processed)`);
      return;
    }

    console.log(`[ChallengeJob] Claimed ${claimedChallenges.length} challenges for goal ${goalId}`);

    // Generate challenges
    const result = await generateAllChallengesForGoal(user, goal, resource, claimedChallenges, operation);

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
export function startGenerateChallengesJob(userId: string, goalId: string, operation?: string): void {
  after(async () => {
    await runGenerateChallengesJob(userId, goalId, operation);
  });
}
