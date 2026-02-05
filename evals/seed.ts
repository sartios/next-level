import { eq } from 'drizzle-orm';
import { requireDb } from '@/lib/db';
import { users, goals, learningResources, learningResourceSections, challenges } from '@/lib/db/schema';
import { UserSkillDatasetItem, SkillResourceDatasetItem, ChallengeGeneratorDatasetItem } from './types';

/**
 * Seed a user into the database for evaluation.
 * Uses upsert to avoid conflicts if the user already exists.
 */
export async function seedUser(userData: { id: string; role: string; skills: string[]; careerGoals: string[] }) {
  const db = requireDb();

  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.id, userData.id)).limit(1);

  if (existing.length > 0) {
    // Update existing user
    await db
      .update(users)
      .set({
        role: userData.role,
        skills: userData.skills,
        careerGoals: userData.careerGoals,
        updatedAt: new Date()
      })
      .where(eq(users.id, userData.id));
  } else {
    // Insert new user with specific ID
    await db.insert(users).values({
      id: userData.id,
      role: userData.role,
      skills: userData.skills,
      careerGoals: userData.careerGoals
    });
  }
}

/**
 * Seed a goal into the database for evaluation.
 */
export async function seedGoal(goalData: { id: string; userId: string; name: string; reasoning: string }) {
  const db = requireDb();

  const existing = await db.select().from(goals).where(eq(goals.id, goalData.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(goals)
      .set({
        name: goalData.name,
        reasoning: goalData.reasoning,
        updatedAt: new Date()
      })
      .where(eq(goals.id, goalData.id));
  } else {
    await db.insert(goals).values({
      id: goalData.id,
      userId: goalData.userId,
      name: goalData.name,
      reasoning: goalData.reasoning
    });
  }
}

type ResourceType = 'course' | 'book' | 'tutorial' | 'article';

/**
 * Seed a learning resource into the database for evaluation.
 */
export async function seedResource(resourceData: {
  id: string;
  title: string;
  provider: string;
  resourceType: string;
  description?: string;
  learningObjectives?: string[];
}) {
  const db = requireDb();
  const resourceType = resourceData.resourceType as ResourceType;

  const existing = await db.select().from(learningResources).where(eq(learningResources.id, resourceData.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(learningResources)
      .set({
        title: resourceData.title,
        provider: resourceData.provider,
        resourceType,
        description: resourceData.description || null,
        learningObjectives: resourceData.learningObjectives || [],
        updatedAt: new Date()
      })
      .where(eq(learningResources.id, resourceData.id));
  } else {
    await db.insert(learningResources).values({
      id: resourceData.id,
      title: resourceData.title,
      url: `https://eval.example.com/resource/${resourceData.id}`,
      provider: resourceData.provider,
      resourceType,
      description: resourceData.description || null,
      learningObjectives: resourceData.learningObjectives || []
    });
  }
}

/**
 * Seed a resource section into the database for evaluation.
 */
export async function seedResourceSection(sectionData: { id: string; resourceId: string; title: string; topics?: string[] }) {
  const db = requireDb();

  const existing = await db.select().from(learningResourceSections).where(eq(learningResourceSections.id, sectionData.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(learningResourceSections)
      .set({
        title: sectionData.title,
        topics: sectionData.topics || []
      })
      .where(eq(learningResourceSections.id, sectionData.id));
  } else {
    await db.insert(learningResourceSections).values({
      id: sectionData.id,
      resourceId: sectionData.resourceId,
      title: sectionData.title,
      topics: sectionData.topics || [],
      orderIndex: 0
    });
  }
}

/**
 * Seed a challenge into the database for evaluation.
 */
export async function seedChallenge(challengeData: {
  id: string;
  goalId: string;
  sectionId: string;
  sectionTitle: string;
  sectionTopics?: string[] | null;
  difficulty: 'easy' | 'medium' | 'hard';
}) {
  const db = requireDb();

  const existing = await db.select().from(challenges).where(eq(challenges.id, challengeData.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(challenges)
      .set({
        sectionTitle: challengeData.sectionTitle,
        sectionTopics: challengeData.sectionTopics || [],
        difficulty: challengeData.difficulty,
        status: 'pending',
        updatedAt: new Date()
      })
      .where(eq(challenges.id, challengeData.id));
  } else {
    await db.insert(challenges).values({
      id: challengeData.id,
      goalId: challengeData.goalId,
      sectionId: challengeData.sectionId,
      sectionTitle: challengeData.sectionTitle,
      sectionTopics: challengeData.sectionTopics || [],
      difficulty: challengeData.difficulty,
      status: 'pending',
      totalQuestions: 10
    });
  }
}

/**
 * Seed all data for UserSkillAgent evaluation items.
 */
export async function seedUserSkillAgentData(items: UserSkillDatasetItem[]) {
  console.log(`  Seeding ${items.length} users for user-skill-agent evaluation...`);

  for (const item of items) {
    await seedUser(item.input.user);
  }

  console.log(`  Seeded ${items.length} users`);
}

/**
 * Seed all data for SkillResourceRetriever evaluation items.
 */
export async function seedSkillResourceRetrieverData(items: SkillResourceDatasetItem[]) {
  console.log(`  Seeding ${items.length} users and goals for skill-resource-retriever evaluation...`);

  for (const item of items) {
    await seedUser(item.input.user);
    await seedGoal(item.input.goal);
  }

  console.log(`  Seeded ${items.length} users and goals`);
}

/**
 * Seed all data for ChallengeGenerator evaluation items.
 */
export async function seedChallengeGeneratorData(items: ChallengeGeneratorDatasetItem[]) {
  console.log(`  Seeding data for challenge-generator evaluation...`);

  for (const item of items) {
    const { user, goal, resource, challenge } = item.input;

    // Seed user
    await seedUser(user);

    // Seed goal
    await seedGoal(goal);

    // Seed resource
    await seedResource(resource);

    // Seed resource section
    await seedResourceSection({
      id: challenge.sectionId,
      resourceId: resource.id,
      title: challenge.sectionTitle,
      topics: challenge.sectionTopics || undefined
    });

    // Seed challenge
    await seedChallenge({
      id: challenge.id,
      goalId: goal.id,
      sectionId: challenge.sectionId,
      sectionTitle: challenge.sectionTitle,
      sectionTopics: challenge.sectionTopics,
      difficulty: challenge.difficulty
    });
  }

  console.log(`  Seeded ${items.length} complete challenge datasets`);
}
