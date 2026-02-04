import { eq } from 'drizzle-orm';
import { requireDb } from '.';
import { goals, challenges, type ChallengeDifficulty, type ChallengeStatus } from './schema';

interface Goal {
  id: string;
  userId: string;
  name: string;
  reasoning: string;
  selectedResourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SectionInfo {
  id: string;
  title: string;
  topics: string[];
}

const DIFFICULTY_LEVELS: ChallengeDifficulty[] = ['easy', 'medium', 'hard'];

function getInitialStatus(difficulty: ChallengeDifficulty): ChallengeStatus {
  return difficulty === 'easy' ? 'pending' : 'locked';
}

/**
 * Atomically update a goal's selected resource and create challenge placeholders.
 * Both operations happen in a single transaction to ensure consistency.
 */
export async function selectResourceAndCreateChallenges(
  goalId: string,
  resourceId: string,
  sections: SectionInfo[] | null
): Promise<Goal> {
  const db = requireDb();

  return await db.transaction(async (tx) => {
    // Update the goal with selected resource
    const [updatedGoal] = await tx
      .update(goals)
      .set({ selectedResourceId: resourceId, updatedAt: new Date() })
      .where(eq(goals.id, goalId))
      .returning();

    if (!updatedGoal) {
      throw new Error('Failed to update goal');
    }

    // Create challenges if sections are provided
    if (sections && sections.length > 0) {
      const values = sections.flatMap((section) =>
        DIFFICULTY_LEVELS.map((difficulty) => ({
          goalId,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionTopics: section.topics,
          difficulty,
          status: getInitialStatus(difficulty),
          totalQuestions: 10
        }))
      );

      await tx.insert(challenges).values(values);
    }

    return updatedGoal;
  });
}
