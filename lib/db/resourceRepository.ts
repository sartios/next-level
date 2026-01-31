import { eq, and, inArray } from 'drizzle-orm';
import { requireDb } from './index';
import { learningResources, learningResourceSections, skillResources } from './schema';
import type {
  NewLearningResource,
  NewLearningResourceSection,
  LearningResource,
  LearningResourceSection,
  SkillResource,
  LearningResourceWithSections
} from '../types';

// Re-export type for backward compatibility
export type { LearningResourceWithSections } from '../types';

// ============================================================================
// Learning Resources
// ============================================================================

/**
 * Insert a learning resource
 */
export async function insertLearningResource(resource: NewLearningResource): Promise<LearningResource> {
  const db = requireDb();
  const [inserted] = await db.insert(learningResources).values(resource).returning();
  return inserted;
}

/**
 * Get a learning resource by URL
 */
export async function getLearningResourceByUrl(url: string): Promise<LearningResource | undefined> {
  const db = requireDb();
  const results = await db.select().from(learningResources).where(eq(learningResources.url, url)).limit(1);
  return results[0];
}

/**
 * Get a learning resource by ID
 */
export async function getLearningResourceById(id: string): Promise<LearningResource | undefined> {
  const db = requireDb();
  const results = await db.select().from(learningResources).where(eq(learningResources.id, id)).limit(1);
  return results[0];
}

/**
 * Get a learning resource by ID with sections
 */
export async function getLearningResourceWithSections(id: string): Promise<LearningResourceWithSections | undefined> {
  const resource = await getLearningResourceById(id);
  if (!resource) return undefined;

  const sections = await getResourceSections(id);
  return { ...resource, sections };
}

/**
 * Get multiple learning resources by IDs
 */
export async function getLearningResourcesByIds(ids: string[]): Promise<LearningResource[]> {
  if (ids.length === 0) return [];
  const db = requireDb();
  return db.select().from(learningResources).where(inArray(learningResources.id, ids));
}

/**
 * Get multiple learning resources by IDs with sections
 */
export async function getLearningResourcesWithSections(ids: string[]): Promise<LearningResourceWithSections[]> {
  if (ids.length === 0) return [];

  const resources = await getLearningResourcesByIds(ids);
  const sectionsMap = await getResourceSectionsBatch(ids);

  return resources.map((r) => ({
    ...r,
    sections: sectionsMap.get(r.id) || []
  }));
}

// ============================================================================
// Learning Resource Sections
// ============================================================================

/**
 * Get sections for a specific resource
 */
export async function getResourceSections(resourceId: string): Promise<LearningResourceSection[]> {
  const db = requireDb();
  return db
    .select()
    .from(learningResourceSections)
    .where(eq(learningResourceSections.resourceId, resourceId))
    .orderBy(learningResourceSections.orderIndex);
}

/**
 * Get sections for multiple resources (batch)
 */
export async function getResourceSectionsBatch(resourceIds: string[]): Promise<Map<string, LearningResourceSection[]>> {
  if (resourceIds.length === 0) return new Map();

  const db = requireDb();
  const sections = await db
    .select()
    .from(learningResourceSections)
    .where(inArray(learningResourceSections.resourceId, resourceIds))
    .orderBy(learningResourceSections.orderIndex);

  const sectionMap = new Map<string, LearningResourceSection[]>();
  for (const section of sections) {
    const existing = sectionMap.get(section.resourceId) || [];
    existing.push(section);
    sectionMap.set(section.resourceId, existing);
  }

  return sectionMap;
}

/**
 * Insert multiple sections for a resource
 */
export async function insertResourceSections(
  resourceId: string,
  sections: Array<{ title: string; estimatedMinutes?: number; topics?: string[] }>
): Promise<LearningResourceSection[]> {
  if (sections.length === 0) return [];

  const db = requireDb();
  const sectionsToInsert: NewLearningResourceSection[] = sections.map((section, index) => ({
    resourceId,
    title: section.title,
    estimatedMinutes: section.estimatedMinutes ?? null,
    orderIndex: index,
    topics: section.topics ?? []
  }));

  return db.insert(learningResourceSections).values(sectionsToInsert).returning();
}

// ============================================================================
// Skill-Resource Links
// ============================================================================

/**
 * Link a skill to a resource with a proficiency level
 */
export async function linkSkillToResource(
  skillId: string,
  resourceId: string,
  level: 'beginner' | 'intermediate' | 'expert'
): Promise<SkillResource> {
  const db = requireDb();

  // Check if link already exists
  const existing = await db
    .select()
    .from(skillResources)
    .where(and(eq(skillResources.skillId, skillId), eq(skillResources.resourceId, resourceId), eq(skillResources.level, level)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [inserted] = await db.insert(skillResources).values({ skillId, resourceId, level }).returning();

  return inserted;
}
