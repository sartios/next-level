import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { learningResources, resourceEmbeddings } from '../../lib/db/schema';
import { insertLearningResource } from '../../lib/db/resourceRepository';
import {
  insertResourceEmbedding,
  insertResourceEmbeddings,
  searchEmbeddings,
  searchByResource,
  searchByDescription,
  searchByLearningObjective,
  getUniqueResourcesFromResults
} from '../../lib/db/embeddingRepository';
import type { NewLearningResource, NewResourceEmbedding } from '../../lib/types';

describe('embeddingRepository integration tests', () => {
  const testResourceUrl = `https://test-embedding-${Date.now()}.com/course`;
  let insertedResourceId: string;

  // Create a simple test embedding (1536 dimensions for OpenAI compatibility)
  const createTestEmbedding = (seed: number): number[] => {
    const embedding = new Array(1536).fill(0).map((_, i) => Math.sin(seed + i * 0.01));
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / magnitude);
  };

  const testResource: NewLearningResource = {
    url: testResourceUrl,
    title: 'Test Course for Embedding Testing',
    description: 'A test course for testing embedding operations',
    provider: 'test-provider',
    resourceType: 'course',
    learningObjectives: ['Learn embeddings'],
    targetAudience: ['ML Engineers'],
    totalHours: 5
  };

  beforeAll(async () => {
    // Insert a test resource first
    const resource = await insertLearningResource(testResource);
    insertedResourceId = resource.id;
  });

  afterAll(async () => {
    // Clean up test data
    const db = requireDb();
    await db.delete(resourceEmbeddings).where(eq(resourceEmbeddings.resourceId, insertedResourceId));
    await db.delete(learningResources).where(eq(learningResources.url, testResourceUrl));
    await closeConnection();
  });

  describe('insertResourceEmbedding', () => {
    it('should insert a single embedding', async () => {
      const embedding: NewResourceEmbedding = {
        resourceId: insertedResourceId,
        contentType: 'resource',
        contentIndex: null,
        sectionId: null,
        contentText: 'Full resource text for embedding',
        embedding: createTestEmbedding(1)
      };

      const result = await insertResourceEmbedding(embedding);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.resourceId).toBe(insertedResourceId);
      expect(result.contentType).toBe('resource');
      expect(result.contentText).toBe(embedding.contentText);
    });
  });

  describe('insertResourceEmbeddings', () => {
    it('should insert multiple embeddings in batch', async () => {
      const embeddings: NewResourceEmbedding[] = [
        {
          resourceId: insertedResourceId,
          contentType: 'description',
          contentIndex: null,
          sectionId: null,
          contentText: 'Test description text',
          embedding: createTestEmbedding(2)
        },
        {
          resourceId: insertedResourceId,
          contentType: 'learning_objective',
          contentIndex: 0,
          sectionId: null,
          contentText: 'Learn about embeddings',
          embedding: createTestEmbedding(3)
        },
        {
          resourceId: insertedResourceId,
          contentType: 'target_audience',
          contentIndex: 0,
          sectionId: null,
          contentText: 'ML Engineers',
          embedding: createTestEmbedding(4)
        }
      ];

      const result = await insertResourceEmbeddings(embeddings);

      expect(result).toHaveLength(3);
      expect(result[0].contentType).toBe('description');
      expect(result[1].contentType).toBe('learning_objective');
      expect(result[2].contentType).toBe('target_audience');
    });

    it('should return empty array when no embeddings provided', async () => {
      const result = await insertResourceEmbeddings([]);

      expect(result).toEqual([]);
    });
  });

  describe('searchEmbeddings', () => {
    it('should search embeddings by similarity', async () => {
      // Use a query embedding similar to seed 1 (the 'resource' type)
      const queryEmbedding = createTestEmbedding(1);

      const results = await searchEmbeddings(queryEmbedding, {
        limit: 10,
        includeResource: true
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should find at least our test embeddings
      expect(results.length).toBeGreaterThan(0);
      // Results should have similarity scores
      expect(results[0].similarity).toBeDefined();
      expect(typeof results[0].similarity).toBe('number');
    });

    it('should filter by content types', async () => {
      const queryEmbedding = createTestEmbedding(2);

      const results = await searchEmbeddings(queryEmbedding, {
        limit: 10,
        contentTypes: ['description'],
        includeResource: true
      });

      expect(results).toBeDefined();
      // All results should be of type 'description'
      for (const result of results) {
        expect(result.contentType).toBe('description');
      }
    });

    it('should respect limit parameter', async () => {
      const queryEmbedding = createTestEmbedding(1);

      const results = await searchEmbeddings(queryEmbedding, {
        limit: 2,
        includeResource: false
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('searchByResource', () => {
    it('should search only resource-type embeddings', async () => {
      const queryEmbedding = createTestEmbedding(1);

      const results = await searchByResource(queryEmbedding, 5);

      expect(results).toBeDefined();
      for (const result of results) {
        expect(result.contentType).toBe('resource');
      }
    });
  });

  describe('searchByDescription', () => {
    it('should search only description-type embeddings', async () => {
      const queryEmbedding = createTestEmbedding(2);

      const results = await searchByDescription(queryEmbedding, 5);

      expect(results).toBeDefined();
      for (const result of results) {
        expect(result.contentType).toBe('description');
      }
    });
  });

  describe('searchByLearningObjective', () => {
    it('should search only learning_objective-type embeddings', async () => {
      const queryEmbedding = createTestEmbedding(3);

      const results = await searchByLearningObjective(queryEmbedding, 5);

      expect(results).toBeDefined();
      for (const result of results) {
        expect(result.contentType).toBe('learning_objective');
      }
    });
  });

  describe('getUniqueResourcesFromResults', () => {
    it('should deduplicate results and keep best match per resource', async () => {
      const queryEmbedding = createTestEmbedding(1);

      const searchResults = await searchEmbeddings(queryEmbedding, {
        limit: 20,
        includeResource: true
      });

      const uniqueResources = getUniqueResourcesFromResults(searchResults);

      // Should have unique resource IDs
      const resourceIds = uniqueResources.map((r) => r.id);
      const uniqueIds = [...new Set(resourceIds)];
      expect(resourceIds.length).toBe(uniqueIds.length);

      // Each result should have bestMatch info
      for (const resource of uniqueResources) {
        expect(resource.bestMatch).toBeDefined();
        expect(resource.bestMatch.contentType).toBeDefined();
        expect(resource.bestMatch.similarity).toBeDefined();
        expect(typeof resource.bestMatch.similarity).toBe('number');
      }

      // Results should be sorted by similarity (descending)
      for (let i = 1; i < uniqueResources.length; i++) {
        expect(uniqueResources[i - 1].bestMatch.similarity).toBeGreaterThanOrEqual(uniqueResources[i].bestMatch.similarity);
      }
    });

    it('should return empty array for empty results', () => {
      const uniqueResources = getUniqueResourcesFromResults([]);

      expect(uniqueResources).toEqual([]);
    });
  });
});
