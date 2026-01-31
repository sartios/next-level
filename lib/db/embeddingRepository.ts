import { sql, inArray } from 'drizzle-orm';
import { requireDb } from './index';
import { learningResources, resourceEmbeddings } from './schema';
import { getResourceSectionsBatch } from './resourceRepository';
import type {
  NewResourceEmbedding,
  ResourceEmbedding,
  EmbeddingContentType,
  LearningResourceWithSections,
  EmbeddingSearchResult
} from '../types';

/**
 * Convert embedding array to pgvector format string.
 * Drizzle's sql template parameterizes this value ($1, $2, etc.),
 * protecting against SQL injection.
 */
function toVectorString(embedding: number[]): string {
  return JSON.stringify(embedding);
}

// ============================================================================
// Embedding CRUD Operations
// ============================================================================

/**
 * Insert a single embedding for a resource
 */
export async function insertResourceEmbedding(embedding: NewResourceEmbedding): Promise<ResourceEmbedding> {
  const db = requireDb();
  const [inserted] = await db.insert(resourceEmbeddings).values(embedding).returning();
  return inserted;
}

/**
 * Insert multiple embeddings for a resource (batch insert)
 */
export async function insertResourceEmbeddings(embeddings: NewResourceEmbedding[]): Promise<ResourceEmbedding[]> {
  if (embeddings.length === 0) return [];
  const db = requireDb();
  return db.insert(resourceEmbeddings).values(embeddings).returning();
}

// ============================================================================
// Embedding Search Operations
// ============================================================================

/**
 * Search embeddings by similarity across all content types
 */
export async function searchEmbeddings(
  queryEmbedding: number[],
  options: {
    limit?: number;
    contentTypes?: EmbeddingContentType[];
    includeResource?: boolean;
  } = {}
): Promise<EmbeddingSearchResult[]> {
  const { limit = 10, contentTypes, includeResource = true } = options;
  const db = requireDb();
  const serializedEmbedding = toVectorString(queryEmbedding);

  let query = sql`
    SELECT
      re.resource_id as "resourceId",
      re.content_type as "contentType",
      re.content_index as "contentIndex",
      re.section_id as "sectionId",
      re.content_text as "contentText",
      1 - (re.embedding <=> ${serializedEmbedding}::vector) as similarity
    FROM resource_embeddings re
  `;

  if (contentTypes && contentTypes.length > 0) {
    query = sql`${query} WHERE re.content_type = ANY(${contentTypes})`;
  }

  query = sql`${query} ORDER BY re.embedding <=> ${serializedEmbedding}::vector LIMIT ${limit}`;

  const results = await db.execute(query);
  const searchResults = results.rows as unknown as EmbeddingSearchResult[];

  if (includeResource && searchResults.length > 0) {
    const resourceIds = [...new Set(searchResults.map((r) => r.resourceId))];
    const resources = await db.select().from(learningResources).where(inArray(learningResources.id, resourceIds));

    // Fetch sections for all resources
    const sectionsMap = await getResourceSectionsBatch(resourceIds);

    const resourceMap = new Map(
      resources.map((r) => [r.id, { ...r, sections: sectionsMap.get(r.id) || [] } as LearningResourceWithSections])
    );
    for (const result of searchResults) {
      result.resource = resourceMap.get(result.resourceId);
    }
  }

  return searchResults;
}

/**
 * Search for resources by description similarity
 */
export async function searchByDescription(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['description'],
    includeResource: true
  });
}

/**
 * Search for resources by learning objective similarity
 */
export async function searchByLearningObjective(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['learning_objective'],
    includeResource: true
  });
}

/**
 * Search for resources by section similarity
 */
export async function searchBySection(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['section'],
    includeResource: true
  });
}

/**
 * Search for resources by overall resource similarity (combined content)
 */
export async function searchByResource(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['resource'],
    includeResource: true
  });
}

/**
 * Get unique resources from embedding search results, ranked by best match
 */
export function getUniqueResourcesFromResults(
  results: EmbeddingSearchResult[]
): (LearningResourceWithSections & { bestMatch: { contentType: EmbeddingContentType; contentText: string; similarity: number } })[] {
  const resourceMap = new Map<
    string,
    LearningResourceWithSections & { bestMatch: { contentType: EmbeddingContentType; contentText: string; similarity: number } }
  >();

  for (const result of results) {
    if (!result.resource) continue;

    const existing = resourceMap.get(result.resourceId);
    if (!existing || result.similarity > existing.bestMatch.similarity) {
      resourceMap.set(result.resourceId, {
        ...result.resource,
        bestMatch: {
          contentType: result.contentType,
          contentText: result.contentText,
          similarity: result.similarity
        }
      });
    }
  }

  return Array.from(resourceMap.values()).sort((a, b) => b.bestMatch.similarity - a.bestMatch.similarity);
}
