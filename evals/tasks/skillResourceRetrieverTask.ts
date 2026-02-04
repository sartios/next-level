import skillResourceAgent, { RetrieverOutputSchema } from '@/lib/agents/SkillResourceRetrieverAgent';
import { SkillResourceDatasetItem, EvaluationTaskResult } from '../types';
import { getAgentPrompt } from '@/lib/prompts';

/**
 * Evaluation task for the SkillResourceAgent retriever step.
 * Tests RAG retrieval quality - how well resources are retrieved from the curated database.
 */
export async function skillResourceRetrieverTask(item: SkillResourceDatasetItem): Promise<EvaluationTaskResult> {
  // Measure response time
  const startTime = Date.now();

  const result = await skillResourceAgent.retrieve(item.input.user, item.input.goal, {
    tags: ['evaluation', 'retriever'],
    metadata: {
      evaluationId: item.id,
      evaluationName: item.name,
      goalName: item.input.goal.name
    }
  });

  const responseTimeMs = Date.now() - startTime;

  // Build context for LLM-as-judge metrics
  const context = [
    `Goal: ${item.input.goal.name}`,
    `User role: ${item.input.user.role}`,
    `User current skills: ${item.input.user.skills.join(', ')}`,
    `Expected minimum resources: ${item.expected.minResourceCount}`,
    `Expected providers: ${item.expected.expectedProviders?.join(', ') || 'any'}`
  ];

  // Get input prompt for LLM-as-judge metrics
  const input = await getAgentPrompt('skill-resource-retriever-agent:system-prompt');

  // Map resources to evaluation format
  const resources = result.resources.map((r) => ({
    title: r.title,
    url: r.url
  }));

  return {
    // LLM-as-judge metrics (Hallucination, AnswerRelevance, Usefulness)
    input,
    output: JSON.stringify(result.resources),
    context,

    // Custom metrics - agent output data
    taskOutput: {
      rawOutput: { resources: result.resources },
      responseTimeMs,
      resources
    },

    // Custom metrics - expected/ground truth data
    reference: {
      schema: RetrieverOutputSchema,
      schemaName: 'RetrieverOutputSchema',
      minResourceCount: item.expected.minResourceCount,
      expectedResourceUrls: item.expected.expectedResourceUrls
    }
  };
}
