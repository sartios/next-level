import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { learningResources } from '../../lib/db/schema';
import {
  insertLearningResource,
  getLearningResourceByUrl,
  getLearningResourceById,
  getLearningResourceWithSections,
  getLearningResourcesByIds,
  getLearningResourcesWithSections,
  getResourceSections,
  insertResourceSections
} from '../../lib/db/resourceRepository';
import type { NewLearningResource } from '../../lib/types';

describe('resourceRepository integration tests', () => {
  const testResourceUrl = `https://test-resource-${Date.now()}.com/course`;
  let insertedResourceId: string;

  const testResource: NewLearningResource = {
    url: testResourceUrl,
    title: 'Test Course for Integration Testing',
    description: 'A test course used for integration testing',
    provider: 'test-provider',
    resourceType: 'course',
    learningObjectives: ['Learn testing', 'Master integration tests'],
    targetAudience: ['Developers', 'QA Engineers'],
    totalHours: 10
  };

  afterAll(async () => {
    // Clean up test data
    const db = requireDb();
    await db.delete(learningResources).where(eq(learningResources.url, testResourceUrl));
    await closeConnection();
  });

  describe('insertLearningResource', () => {
    it('should insert a learning resource and return it with an id', async () => {
      const result = await insertLearningResource(testResource);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.url).toBe(testResource.url);
      expect(result.title).toBe(testResource.title);
      expect(result.provider).toBe(testResource.provider);
      expect(result.resourceType).toBe(testResource.resourceType);
      expect(result.learningObjectives).toEqual(testResource.learningObjectives);
      expect(result.targetAudience).toEqual(testResource.targetAudience);

      insertedResourceId = result.id;
    });
  });

  describe('getLearningResourceByUrl', () => {
    it('should find a resource by URL', async () => {
      const result = await getLearningResourceByUrl(testResourceUrl);

      expect(result).toBeDefined();
      expect(result?.url).toBe(testResourceUrl);
      expect(result?.title).toBe(testResource.title);
    });

    it('should return undefined for non-existent URL', async () => {
      const result = await getLearningResourceByUrl('https://non-existent-url.com');

      expect(result).toBeUndefined();
    });
  });

  describe('getLearningResourceById', () => {
    it('should find a resource by ID', async () => {
      const result = await getLearningResourceById(insertedResourceId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(insertedResourceId);
      expect(result?.title).toBe(testResource.title);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await getLearningResourceById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeUndefined();
    });
  });

  describe('insertResourceSections', () => {
    it('should insert sections for a resource', async () => {
      const sections = [
        { title: 'Introduction', estimatedMinutes: 15, topics: ['Overview', 'Setup'] },
        { title: 'Main Content', estimatedMinutes: 60, topics: ['Core concepts'] },
        { title: 'Conclusion', estimatedMinutes: 10 }
      ];

      const result = await insertResourceSections(insertedResourceId, sections);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('Introduction');
      expect(result[0].orderIndex).toBe(0);
      expect(result[0].topics).toEqual(['Overview', 'Setup']);
      expect(result[1].title).toBe('Main Content');
      expect(result[1].orderIndex).toBe(1);
      expect(result[2].title).toBe('Conclusion');
      expect(result[2].orderIndex).toBe(2);
    });

    it('should return empty array when no sections provided', async () => {
      const result = await insertResourceSections(insertedResourceId, []);

      expect(result).toEqual([]);
    });
  });

  describe('getResourceSections', () => {
    it('should retrieve sections for a resource in order', async () => {
      const result = await getResourceSections(insertedResourceId);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].orderIndex).toBe(0);
      expect(result[1].orderIndex).toBe(1);
      expect(result[2].orderIndex).toBe(2);
    });
  });

  describe('getLearningResourceWithSections', () => {
    it('should retrieve a resource with its sections', async () => {
      const result = await getLearningResourceWithSections(insertedResourceId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(insertedResourceId);
      expect(result?.sections).toBeDefined();
      expect(result?.sections.length).toBeGreaterThanOrEqual(3);
    });

    it('should return undefined for non-existent resource', async () => {
      const result = await getLearningResourceWithSections('00000000-0000-0000-0000-000000000000');

      expect(result).toBeUndefined();
    });
  });

  describe('getLearningResourcesByIds', () => {
    it('should retrieve multiple resources by IDs', async () => {
      const result = await getLearningResourcesByIds([insertedResourceId]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(insertedResourceId);
    });

    it('should return empty array for empty ID list', async () => {
      const result = await getLearningResourcesByIds([]);

      expect(result).toEqual([]);
    });
  });

  describe('getLearningResourcesWithSections', () => {
    it('should retrieve multiple resources with sections', async () => {
      const result = await getLearningResourcesWithSections([insertedResourceId]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(insertedResourceId);
      expect(result[0].sections).toBeDefined();
      expect(result[0].sections.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for empty ID list', async () => {
      const result = await getLearningResourcesWithSections([]);

      expect(result).toEqual([]);
    });
  });
});
