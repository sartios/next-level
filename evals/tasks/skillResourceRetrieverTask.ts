import skillResourceAgent from '@/lib/agents/SkillResourceRetrieverAgent';
import { SkillResourceDatasetItem } from '../types';
import { getAgentPrompt } from '@/lib/prompts';
import { LearningResourceWithSections } from '@/lib/types';

/**
 * Evaluation task for the SkillResourceRetrieverAgent.
 * Tests RAG retrieval quality using streaming and Opik's built-in LLM-as-judge metrics.
 */
export async function skillResourceRetrieverTask(item: SkillResourceDatasetItem): Promise<{
  input: string;
  output: string;
  context: string[];
}> {
  // Use streaming method and collect the complete result
  let resources: LearningResourceWithSections[] = [];

  for await (const event of skillResourceAgent.streamResources(item.input.user, item.input.goal, {
    tags: ['evaluation', 'skill-resource-retriever'],
    metadata: {
      evaluationId: item.id,
      evaluationName: item.name,
      goalName: item.input.goal.name
    }
  })) {
    if (event.type === 'complete' && event.result) {
      resources = event.result.resources;
    }
  }

  // Get input prompt for LLM-as-judge metrics
  const systemPrompt = await getAgentPrompt('skill-resource-retriever-agent:system-prompt');

  // Build context for grounding the evaluation
  // Include the actual output schema that the agent returns
  const context = [
    `User ID: ${item.input.user.id}`,
    `User role: ${item.input.user.role}`,
    `User current skills: ${item.input.user.skills.join(', ')}`,
    `User career goals: ${item.input.user.careerGoals.join(', ')}`,
    `Goal ID: ${item.input.goal.id}`,
    `Goal: ${item.input.goal.name}`,
    `Goal reasoning: ${item.input.goal.reasoning}`,
    `Expected minimum resources: ${item.expected.minResourceCount}`,
    `Expected providers: ${item.expected.expectedProviders?.join(', ') || 'any'}`,
    `Output format: Array of LearningResourceWithSections objects containing: id, url, title, description, provider, resourceType, learningObjectives, targetAudience, totalHours, sections (array of section objects)`
  ];

  return {
    input: systemPrompt,
    output: JSON.stringify(resources),
    context
  };
}
