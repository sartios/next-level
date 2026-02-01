import { BaseMetric, type EvaluationScoreResult } from 'opik';
import { z } from 'zod';

const GOOD_PERFORMANCE_THRESHOLD_MS = 5000;

const validationSchema = z.object({
  taskOutput: z.object({
    responseTimeMs: z.number()
  })
});

type Input = z.infer<typeof validationSchema>;

/**
 * Response Time Performance metric.
 * Evaluates whether the agent responded within an acceptable time threshold.
 *
 * Returns a binary score:
 * - 1 = Good performance (response time <= 5 seconds)
 * - 0 = Bad performance (response time > 5 seconds)
 */
export class ResponseTimeMetric extends BaseMetric {
  validationSchema = validationSchema;

  constructor(name = 'response_time_performance', trackMetric = true) {
    super(name, trackMetric);
  }

  async score(input: Input): Promise<EvaluationScoreResult> {
    const { taskOutput } = input;

    try {
      const responseTimeMs = taskOutput.responseTimeMs;

      if (typeof responseTimeMs !== 'number' || isNaN(responseTimeMs)) {
        return {
          name: this.name,
          value: 0,
          reason: 'Response time not available or invalid'
        };
      }

      const responseTimeSec = responseTimeMs / 1000;

      if (responseTimeMs <= GOOD_PERFORMANCE_THRESHOLD_MS) {
        return {
          name: this.name,
          value: 1,
          reason: `Good performance: ${responseTimeSec.toFixed(2)}s (within ${GOOD_PERFORMANCE_THRESHOLD_MS / 1000}s threshold)`
        };
      }

      return {
        name: this.name,
        value: 0,
        reason: `Bad performance: ${responseTimeSec.toFixed(2)}s (exceeds ${GOOD_PERFORMANCE_THRESHOLD_MS / 1000}s threshold)`
      };
    } catch (error) {
      return {
        name: this.name,
        value: 0,
        reason: `Error measuring response time: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
