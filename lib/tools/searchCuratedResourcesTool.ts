import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { createEmbedding } from '@/lib/embeddings';
import { searchEmbeddings, getUniqueResourcesFromResults } from '@/lib/db/embeddingRepository';
import { LearningResourceWithSections } from '@/lib/types';

interface ToolFunctionProps {
  query: string;
  limit: number | null;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_DUPLICATION_MULTIPLIER = 2;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

/**
 * Direct search function - can be called without going through the LangChain tool wrapper.
 * Use this for faster retrieval when you don't need agent reasoning.
 */
export async function searchCuratedResources(query: string, limit: number = DEFAULT_LIMIT): Promise<LearningResourceWithSections[]> {
  const queryEmbedding = await createEmbedding(query);

  // Fetch 2x the requested limit to account for deduplication
  const searchResults = await searchEmbeddings(queryEmbedding, {
    limit: limit * DEFAULT_DUPLICATION_MULTIPLIER,
    includeResource: true
  });

  // Filter by similarity threshold and get unique resources ranked by best match
  const filteredResults = searchResults.filter((result) => result.similarity >= DEFAULT_SIMILARITY_THRESHOLD);
  const uniqueResources = getUniqueResourcesFromResults(filteredResults);

  return uniqueResources.slice(0, limit);
}

const toolFunction = async ({ query, limit }: ToolFunctionProps): Promise<string> => {
  const resources = await searchCuratedResources(query, limit ?? DEFAULT_LIMIT);
  return JSON.stringify(resources);
};

const toolDescription = {
  name: 'searchCuratedResources',
  description: 'Semantic search over curated learning resources. Returns full resource objects with sections, ranked by relevance.',
  schema: z.object({
    query: z.string().describe('Search query combining goal, role, and skills'),
    limit: z.number().nullable().describe('Max results (default: 10)')
  })
};

export const searchCuratedResourcesTool = tool(toolFunction, toolDescription);
