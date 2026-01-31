import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createEmbedding } from '@/lib/embeddings';
import { EmbeddingSearchResult, getUniqueResourcesFromResults, searchEmbeddings } from '../db/embeddingRepository';

interface CuratedResourceSection {
  title: string;
  estimatedMinutes: number | null;
  topics: string[];
}

interface CuratedResourceResult {
  id: string;
  url: string;
  title: string;
  description: string | null;
  provider: string;
  resourceType: string;
  learningObjectives: string[];
  totalHours: string | null;
  sections: CuratedResourceSection[];
  matchedContent: {
    type: string;
    text: string;
    similarity: number;
  };
}

interface ToolFunctionProps {
  query: string;
  skillLevel: string | null;
  limit: number | null;
}

const toolFunction = async ({ query, skillLevel, limit }: ToolFunctionProps): Promise<string> => {
  const searchQuery = skillLevel ? `${query} for ${skillLevel} level learners` : query;
  const queryEmbedding = await createEmbedding(searchQuery);

  const searchResults: EmbeddingSearchResult[] = await searchEmbeddings(queryEmbedding, {
    limit: limit ?? 20,
    includeResource: true
  });
  const uniqueResources = getUniqueResourcesFromResults(searchResults);

  const resources: CuratedResourceResult[] = uniqueResources.slice(0, limit ?? 10).map((resource) => ({
    id: resource.id,
    url: resource.url,
    title: resource.title,
    description: resource.description,
    provider: resource.provider,
    resourceType: resource.resourceType,
    learningObjectives: resource.learningObjectives ?? [],
    totalHours: resource.totalHours,
    sections: resource.sections.map((s) => ({
      title: s.title,
      estimatedMinutes: s.estimatedMinutes,
      topics: s.topics ?? []
    })),
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
