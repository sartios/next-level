import skillResourceAgent, { EvaluatorOutputSchema } from '@/lib/agents/SkillResourceAgent';
import { SkillResourceEvaluatorDatasetItem, EvaluationTaskResult } from '../types';
import { getAgentPrompt } from '@/lib/prompts';
import { Goal } from '@/lib/mockDb';
import { insertLearningResource, insertResourceSections, getLearningResourceByUrl } from '@/lib/db/resourceRepository';
import { LearningResourceWithSections } from '@/lib/types';

/**
 * Inserts resources into the database for evaluation.
 * Skips resources that already exist (by URL).
 * Returns the resources with their database IDs.
 */
async function setupEvaluationResources(resources: LearningResourceWithSections[]): Promise<LearningResourceWithSections[]> {
  const result: LearningResourceWithSections[] = [];

  for (const resource of resources) {
    // Check if resource already exists by URL
    let dbResource = await getLearningResourceByUrl(resource.url);

    if (!dbResource) {
      // Insert the resource
      dbResource = await insertLearningResource({
        url: resource.url,
        title: resource.title,
        description: resource.description ?? null,
        provider: resource.provider,
        resourceType: resource.resourceType,
        learningObjectives: resource.learningObjectives ?? [],
        targetAudience: resource.targetAudience ?? [],
        totalHours: resource.totalHours ?? null
      });

      // Insert sections if any
      if (resource.sections && resource.sections.length > 0) {
        await insertResourceSections(
          dbResource.id,
          resource.sections.map((s) => ({
            title: s.title,
            estimatedMinutes: s.estimatedMinutes ?? undefined,
            topics: s.topics ?? []
          }))
        );
      }
    }

    result.push({
      ...resource,
      id: dbResource.id // Use the database ID
    });
  }

  return result;
}

/**
 * Evaluation task for the SkillResourceAgent evaluator step.
 * Inserts resources into the database before evaluation so the agent can retrieve them.
 */
export async function skillResourceEvaluatorTask(item: SkillResourceEvaluatorDatasetItem): Promise<EvaluationTaskResult> {
  // Insert resources into DB so agent can fetch them
  const dbResources = await setupEvaluationResources(item.input.resources);

  // Measure response time
  const startTime = Date.now();

  const result = await skillResourceAgent.evaluate(item.input.user, item.input.goal as Goal, dbResources, {
    tags: ['evaluation', 'evaluator'],
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
    `Candidate resources provided: ${dbResources.length}`,
    `Expected minimum output: ${item.expected.minResourceCount} resources`
  ];

  // Get input prompt for LLM-as-judge metrics
  const input = await getAgentPrompt('skill-resource-agent:evaluate:system-prompt');

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
      schema: EvaluatorOutputSchema,
      schemaName: 'EvaluatorOutputSchema',
      minResourceCount: item.expected.minResourceCount,
      expectedResourceUrls: item.expected.expectedResourceUrls
    }
  };
}
