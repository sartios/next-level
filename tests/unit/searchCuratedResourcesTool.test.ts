import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/embeddings', () => ({ createEmbedding: vi.fn() }));
vi.mock('@/lib/db/embeddingRepository', () => ({
  searchEmbeddings: vi.fn(),
  getUniqueResourcesFromResults: vi.fn()
}));

import { createEmbedding } from '@/lib/embeddings';
import { searchEmbeddings, getUniqueResourcesFromResults } from '@/lib/db/embeddingRepository';
import { searchCuratedResources, searchCuratedResourcesTool } from '@/lib/tools/searchCuratedResourcesTool';
import { makeResource } from '../helpers/agentTestHarness';
import type { EmbeddingContentType, EmbeddingSearchResult } from '@/lib/types';

const mockCreateEmbedding = vi.mocked(createEmbedding);
const mockSearchEmbeddings = vi.mocked(searchEmbeddings);
const mockGetUniqueResourcesFromResults = vi.mocked(getUniqueResourcesFromResults);

const fakeEmbedding = [0.1, 0.2, 0.3];

describe('searchCuratedResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEmbedding.mockResolvedValue(fakeEmbedding);
  });

  it('should embed the query and search embeddings', async () => {
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    await searchCuratedResources('learn graphql');

    expect(mockCreateEmbedding).toHaveBeenCalledWith('learn graphql');
    expect(mockSearchEmbeddings).toHaveBeenCalledWith(fakeEmbedding, {
      limit: 20,
      includeResource: true
    });
  });

  it('should use 2x limit for deduplication headroom', async () => {
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    await searchCuratedResources('query', 5);

    expect(mockSearchEmbeddings).toHaveBeenCalledWith(fakeEmbedding, {
      limit: 10,
      includeResource: true
    });
  });

  it('should filter results below similarity threshold of 0.5', async () => {
    const results = [
      { similarity: 0.8, resourceId: 'r1', contentType: 'resource', contentText: '', contentIndex: null, sectionId: null },
      { similarity: 0.3, resourceId: 'r2', contentType: 'resource', contentText: '', contentIndex: null, sectionId: null },
      { similarity: 0.6, resourceId: 'r3', contentType: 'resource', contentText: '', contentIndex: null, sectionId: null }
    ] as const satisfies EmbeddingSearchResult[];

    mockSearchEmbeddings.mockResolvedValue(results);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    await searchCuratedResources('query');

    const filteredArg = mockGetUniqueResourcesFromResults.mock.calls[0][0];
    expect(filteredArg).toHaveLength(2);
    expect(filteredArg.every((r: EmbeddingSearchResult) => r.similarity >= 0.5)).toBe(true);
  });

  it('should return unique resources sliced to the requested limit', async () => {
    const bestMatch = { contentType: 'resource' as EmbeddingContentType, contentText: 'text', similarity: 0.9 };
    const resources = [
      { ...makeResource('r1', 'Resource 1'), bestMatch },
      { ...makeResource('r2', 'Resource 2'), bestMatch },
      { ...makeResource('r3', 'Resource 3'), bestMatch }
    ];

    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue(resources);

    const result = await searchCuratedResources('query', 2);

    expect(result).toHaveLength(2);
  });

  it('should default limit to 10', async () => {
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    await searchCuratedResources('query');

    expect(mockSearchEmbeddings).toHaveBeenCalledWith(fakeEmbedding, {
      limit: 20,
      includeResource: true
    });
  });

  it('should return empty array when no results match', async () => {
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    const result = await searchCuratedResources('obscure query');

    expect(result).toEqual([]);
  });
});

describe('searchCuratedResourcesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEmbedding.mockResolvedValue(fakeEmbedding);
  });

  it('should have correct name and description', () => {
    expect(searchCuratedResourcesTool.name).toBe('searchCuratedResources');
    expect(searchCuratedResourcesTool.description).toContain('Semantic search');
  });

  it('should return JSON stringified resources', async () => {
    const bestMatch = { contentType: 'resource' as EmbeddingContentType, contentText: 'text', similarity: 0.9 };
    const resources = [{ ...makeResource('r1', 'Resource 1'), bestMatch }];
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue(resources);

    const result = await searchCuratedResourcesTool.invoke({ query: 'graphql', limit: null });

    expect(JSON.parse(result)).toEqual(resources);
  });

  it('should use default limit when limit is null', async () => {
    mockSearchEmbeddings.mockResolvedValue([]);
    mockGetUniqueResourcesFromResults.mockReturnValue([]);

    await searchCuratedResourcesTool.invoke({ query: 'test', limit: null });

    expect(mockSearchEmbeddings).toHaveBeenCalledWith(fakeEmbedding, {
      limit: 20,
      includeResource: true
    });
  });
});
