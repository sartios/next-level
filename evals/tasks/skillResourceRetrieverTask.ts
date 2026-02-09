import { streamResources } from '@/lib/agents/SkillResourceRetrieverAgent';
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

  // Resolve prompts with the same variables the agent uses
  const queryPromptVariables = {
    userRole: item.input.user.role,
    userSkills: item.input.user.skills.join(', '),
    userCareerGoals: item.input.user.careerGoals.join(', '),
    goalName: item.input.goal.name,
    goalReasoning: item.input.goal.reasoning
  };

  const [systemPrompt, userPrompt] = await Promise.all([
    getAgentPrompt('skill-resource-retriever-agent:query-generation-system-prompt'),
    getAgentPrompt('skill-resource-retriever-agent:query-generation-user-prompt', queryPromptVariables)
  ]);

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
    input: `${systemPrompt}\n\n${userPrompt}`,
    output: JSON.stringify(output),
    context
  };
}
