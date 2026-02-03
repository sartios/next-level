import { BaseMetric, type EvaluationScoreResult } from 'opik';
import { z } from 'zod';

const validationSchema = z.object({
  taskOutput: z.object({
    rawOutput: z.unknown()
  }),
  reference: z.object({
    schema: z.instanceof(z.ZodType),
    schemaName: z.string()
  })
});

type Input = z.infer<typeof validationSchema>;

/**
 * Structured Output Compliance metric.
 * Evaluates whether the agent's output conforms to the expected schema.
 *
 * Checks two things:
 * 1. Output is valid JSON
 * 2. Output validates against the provided Zod schema
 *
 * Returns a score from 0-1 where:
 * - 1.0 = Output fully complies with schema
 * - 0.5 = Valid JSON but doesn't match schema
 * - 0.0 = Invalid JSON or major schema violations
 */
export class StructuredOutputMetric extends BaseMetric {
  validationSchema = validationSchema;

  constructor(name = 'structured_output_compliance', trackMetric = true) {
    super(name, trackMetric);
  }

  async score(input: Input): Promise<EvaluationScoreResult> {
    const { taskOutput, reference } = input;

    try {
      // Step 1: Check if output is valid JSON
      let parsedOutput = taskOutput.rawOutput;

      if (typeof taskOutput.rawOutput === 'string') {
        try {
          parsedOutput = JSON.parse(taskOutput.rawOutput as string);
        } catch {
          return {
            name: this.name,
            value: 0,
            reason: 'Output is not valid JSON'
          };
        }
      }

      // Step 2: Validate against Zod schema
      const parseResult = reference.schema.safeParse(parsedOutput);

      if (parseResult.success) {
        return {
          name: this.name,
          value: 1,
          reason: `Output fully complies with ${reference.schemaName} schema`
        };
      }

      // Calculate partial score based on error count
      const issues = parseResult.error.issues;
      const errorCount = issues.length;

      // Penalize based on number of errors (max 10 errors = 0.5 score)
      const partialScore = Math.max(0.5, 1 - errorCount * 0.05);

      const errorSummary = issues
        .slice(0, 3)
        .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');

      return {
        name: this.name,
        value: partialScore,
        reason: `Schema validation errors: ${errorSummary}${errorCount > 3 ? ` (+${errorCount - 3} more)` : ''}`
      };
    } catch (error) {
      return {
        name: this.name,
        value: 0,
        reason: `Error during schema validation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
