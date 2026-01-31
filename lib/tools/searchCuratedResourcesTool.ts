import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { createEmbedding } from '@/lib/embeddings';
import { getUniqueResourcesFromResults, searchEmbeddings } from '@/lib/db/embeddingRepository';
import { EmbeddingSearchResult, LearningResourceWithSections } from '@/lib/types';

type ToolResponse = LearningResourceWithSections & {
  matchedContent: {
    type: string;
    text: string;
    similarity: number;
  };
};

interface ToolFunctionProps {
  query: string;
  skillLevel: string | null;
  limit: number | null;
}

const DEFAULT_LIMIT = 10;

const toolFunction = async ({ query, skillLevel, limit }: ToolFunctionProps): Promise<string> => {
  const searchQuery = skillLevel ? `${query} for ${skillLevel} level learners` : query;
  const queryEmbedding = await createEmbedding(searchQuery);
  const requestedLimit = limit ?? DEFAULT_LIMIT;

  // Fetch 2x the requested limit to account for deduplication
  const searchResults: EmbeddingSearchResult[] = await searchEmbeddings(queryEmbedding, {
    limit: requestedLimit * 2,
    includeResource: true
  });
  const uniqueResources = getUniqueResourcesFromResults(searchResults);

  const resources: ToolResponse[] = uniqueResources.slice(0, requestedLimit).map((resource) => ({
    ...resource,
    matchedContent: {
      type: resource.bestMatch.contentType,
      text: resource.bestMatch.contentText,
      similarity: resource.bestMatch.similarity
    }
  }));

  return JSON.stringify(resources);
};

const toolDescription = {
  name: 'searchCuratedResources',
  description: `Search the curated learning resources database for resources matching a skill or topic.
Returns verified, high-quality resources from providers like Udemy, Coursera, O'Reilly, etc.
Use this tool FIRST before suggesting any resources to ensure you recommend only curated, verified content.
The search uses semantic similarity to find resources matching the query across titles, descriptions, learning objectives, and sections.`,
  schema: z.object({
    query: z
      .string()
      .describe('The skill, topic, or learning goal to search for (e.g., "Python programming", "machine learning fundamentals")'),
    skillLevel: z
      .enum(['beginner', 'intermediate', 'expert'])
      .nullable()
      .describe('The target skill level to filter resources. Pass null if not specified.'),
    limit: z.number().nullable().describe('Maximum number of resources to return. Pass null for default (10).')
  })
};

export const searchCuratedResourcesTool = tool(toolFunction, toolDescription);
