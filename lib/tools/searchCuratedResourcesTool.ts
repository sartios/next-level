import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { createEmbedding } from '@/lib/embeddings';
import { searchEmbeddings } from '@/lib/db/embeddingRepository';
import { EmbeddingSearchResult } from '@/lib/types';

interface ToolFunctionProps {
  query: string;
  limit: number | null;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

/**
 * Direct search function - can be called without going through the LangChain tool wrapper.
 * Use this for faster retrieval when you don't need agent reasoning.
 */
export async function searchCuratedResources(query: string, limit: number = DEFAULT_LIMIT): Promise<string[]> {
  const queryEmbedding = await createEmbedding(query);

  // Fetch 2x the requested limit to account for deduplication
  const searchResults: EmbeddingSearchResult[] = await searchEmbeddings(queryEmbedding, { limit: limit * 2 });

  const uniqueResourceIds = Array.from(
    new Set(
      searchResults
        .slice(0, limit)
        .filter((result) => result.similarity >= DEFAULT_SIMILARITY_THRESHOLD)
        .map((result) => result.resourceId)
    )
  );

  return uniqueResourceIds.slice(0, limit);
}

const toolFunction = async ({ query, limit }: ToolFunctionProps): Promise<string> => {
  const resources = await searchCuratedResources(query, limit ?? DEFAULT_LIMIT);
  return JSON.stringify(resources);
};

const toolDescription = {
  name: 'searchCuratedResources',
  description: 'Semantic search over curated learning resources. Returns resource IDs ranked by relevance.',
  schema: z.object({
    query: z.string().describe('Search query combining goal, role, and skills'),
    limit: z.number().nullable().describe('Max results (default: 10)')
  })
};

export const searchCuratedResourcesTool = tool(toolFunction, toolDescription);
