import { streamResources } from '@/lib/agents/SkillResourceRetrieverAgent';
import { SkillResourceDatasetItem } from '../types';
import { LearningResourceWithSections } from '@/lib/types';

/**
 * Evaluation task for the SkillResourceRetrieverAgent.
 * Tests RAG retrieval quality using streaming and Opik's built-in LLM-as-judge metrics.
 *
 * The agent uses a hybrid approach: LLM generates search queries internally, then semantic search
 * retrieves resources from embeddings. The judge evaluates the final resource output, not the
 * intermediate query generation step.
 */
export async function skillResourceRetrieverTask(item: SkillResourceDatasetItem): Promise<{
  input: string;
  output: string;
  context: string[];
}> {
  // Use streaming method and collect the complete result
  let resources: LearningResourceWithSections[] = [];

  for await (const event of streamResources(item.input.user, item.input.goal, {
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

  // Build the input describing the end-to-end resource retrieval task.
  // The agent has no standalone system prompt — it only has query-generation prompts used internally.
  // The judge should evaluate whether the retrieved resources match the user's profile and goal.
  const input = [
    `User profile and learning goal:`,
    `Role: ${item.input.user.role}`,
    `Current skills: ${item.input.user.skills.join(', ')}`,
    `Learning goal: ${item.input.goal.name}`,
    `Goal reasoning: ${item.input.goal.reasoning}`,
    `Retrieve a curated set of learning resources that best help this user achieve the learning goal`
  ];

  // Build context for grounding the evaluation
  // Include retrieved resources as context so the Hallucination metric can verify
  // the output faithfully represents what was fetched from the database
  const context = [
    `User role: ${item.input.user.role}`,
    `User current skills: ${item.input.user.skills.join(', ')}`,
    `User career goals: ${item.input.user.careerGoals.join(', ')}`,
    `Goal: ${item.input.goal.name}`,
    `Goal reasoning: ${item.input.goal.reasoning}`,
    `Expected minimum resources: ${item.expected.minResourceCount}`,
    `Expected providers: ${item.expected.expectedProviders?.join(', ') || 'any'}`,
    `Output format: Array of learning resources, each with: title, description, provider, resourceType, learningObjectives, targetAudience, totalHours, sections`,
    ...resources.map(
      (r) =>
        `Retrieved resource: "${r.title}" by ${r.provider} (${r.resourceType}). Description: ${r.description || 'N/A'}. Learning objectives: ${r.learningObjectives?.join('; ') || 'N/A'}. Target audience: ${r.targetAudience || 'N/A'}. Total hours: ${r.totalHours ?? 'N/A'}. Sections: ${r.sections?.map((s) => s.title).join(', ') || 'N/A'}.`
    )
  ];

  // Strip internal IDs — only include fields relevant to the judge
  const output = resources.map((r) => ({
    title: r.title,
    description: r.description,
    provider: r.provider,
    resourceType: r.resourceType,
    learningObjectives: r.learningObjectives,
    targetAudience: r.targetAudience,
    totalHours: r.totalHours,
    sections: r.sections?.map((s) => ({ title: s.title, topics: s.topics }))
  }));

  return {
    input: input.join(','),
    output: JSON.stringify(output),
    context
  };
}
