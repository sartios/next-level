import { BaseMetric, type EvaluationScoreResult } from 'opik';
import { z } from 'zod';

const validationSchema = z.object({
  taskOutput: z.object({
    resources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string()
        })
      )
      .optional()
  }),
  reference: z.object({
    expectedResourceUrls: z.array(z.string()).optional(),
    minResourceCount: z.number()
  })
});

type Input = z.infer<typeof validationSchema>;

/**
 * Metric that evaluates RAG retrieval quality for the SkillResourceAgent.
 * Measures:
 * 1. Whether resources came from the curated database (not hallucinated)
 * 2. How many expected resources were retrieved (if expectedResourceUrls provided)
 * 3. Whether minimum retrieval count was met
 */
export class RAGRetrievalMetric extends BaseMetric {
  validationSchema = validationSchema;

  constructor(name = 'rag_retrieval_quality', trackMetric = true) {
    super(name, trackMetric);
  }

  async score(input: Input): Promise<EvaluationScoreResult> {
    const { taskOutput, reference } = input;
    const resources = taskOutput.resources || [];

    // If no resources returned
    if (resources.length === 0) {
      return {
        name: this.name,
        value: 0,
        reason: 'No resources were retrieved from the curated database'
      };
    }

    const reasons: string[] = [];
    let score = 0;

    // Check 1: Minimum retrieval count (40% weight)
    const minCountMet = resources.length >= reference.minResourceCount;
    if (minCountMet) {
      score += 0.4;
      reasons.push(`Retrieved ${resources.length}/${reference.minResourceCount} minimum resources`);
    } else {
      reasons.push(`Only ${resources.length}/${reference.minResourceCount} resources retrieved`);
    }

    // Check 2: Resources have valid URLs (30% weight) - indicates they came from DB
    const validUrlCount = resources.filter((r) => r.url && r.url.startsWith('http')).length;
    const urlScore = resources.length > 0 ? validUrlCount / resources.length : 0;
    score += urlScore * 0.3;
    reasons.push(`${validUrlCount}/${resources.length} resources have valid URLs`);

    // Check 3: Expected resource matching (30% weight) - if expectedResourceUrls provided
    if (reference.expectedResourceUrls && reference.expectedResourceUrls.length > 0) {
      const returnedUrls = new Set(resources.map((r) => r.url));
      const matchedCount = reference.expectedResourceUrls.filter((url) => returnedUrls.has(url)).length;
      const matchScore = matchedCount / reference.expectedResourceUrls.length;
      score += matchScore * 0.3;
      reasons.push(`${matchedCount}/${reference.expectedResourceUrls.length} expected resources matched`);
    } else {
      // If no expected URLs, give full points for this criteria if resources exist
      score += 0.3;
      reasons.push('No specific expected resources defined');
    }

    return {
      name: this.name,
      value: Math.max(0, Math.min(1, score)),
      reason: reasons.join('; ')
    };
  }
}
