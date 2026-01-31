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
 * Helper to attach resources to search results
 */
async function attachResourcesToResults(results: EmbeddingSearchResult[]): Promise<EmbeddingSearchResult[]> {
  if (results.length === 0) return results;

  const db = requireDb();
  const resourceIds = [...new Set(results.map((r) => r.resourceId))];
  const resources = await db.select().from(learningResources).where(inArray(learningResources.id, resourceIds));
  const sectionsMap = await getResourceSectionsBatch(resourceIds);

  const resourceMap = new Map(
    resources.map((r) => [r.id, { ...r, sections: sectionsMap.get(r.id) || [] } as LearningResourceWithSections])
  );

  for (const result of results) {
    result.resource = resourceMap.get(result.resourceId);
  }

  return results;
}

/**
 * Search embeddings by similarity across all or specific content types
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
  const vectorStr = toVectorString(queryEmbedding);

  let query = sql`
    SELECT
      resource_id as "resourceId",
      content_type as "contentType",
      content_index as "contentIndex",
      section_id as "sectionId",
      content_text as "contentText",
      1 - (embedding <=> ${vectorStr}::vector) as similarity
    FROM resource_embeddings
  `;

  if (contentTypes && contentTypes.length > 0) {
    const contentTypesArray = `{${contentTypes.join(',')}}`;
    query = sql`${query} WHERE content_type = ANY(${contentTypesArray}::text[])`;
  }

  query = sql`${query} ORDER BY embedding <=> ${vectorStr}::vector LIMIT ${limit}`;

  const results = await db.execute(query);
  const searchResults = results.rows as unknown as EmbeddingSearchResult[];

  if (includeResource) {
    return attachResourcesToResults(searchResults);
  }

  return searchResults;
}

/**
 * Search for resources by full resource embedding similarity
 */
export async function searchByResource(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['resource'],
    includeResource: true
  });
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
 * Search for resources by target audience similarity
 */
export async function searchByTargetAudience(queryEmbedding: number[], limit: number = 10): Promise<EmbeddingSearchResult[]> {
  return searchEmbeddings(queryEmbedding, {
    limit,
    contentTypes: ['target_audience'],
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
