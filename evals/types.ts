import { User, Goal } from '@/lib/mockDb';
import { LearningResourceWithSections } from '@/lib/types';
import { z } from 'zod';

// ============================================================================
// Dataset Item Types - Input data for evaluations
// ============================================================================

export interface BaseDatasetItem {
  id: string;
  name: string;
}

export interface SkillResourceDatasetItem extends BaseDatasetItem {
  input: {
    user: User;
    goal: Omit<Goal, 'resources' | 'roadmap' | 'plan'>;
  };
  expected: {
    minResourceCount: number;
    expectedProviders?: string[];
    expectedResourceTypes?: string[];
    expectedResourceUrls?: string[];
  };
}

export interface SkillResourceEvaluatorDatasetItem extends BaseDatasetItem {
  input: {
    user: User;
    goal: Omit<Goal, 'resources' | 'roadmap' | 'plan'>;
    resources: LearningResourceWithSections[];
  };
  expected: {
    minResourceCount: number;
    expectedProviders?: string[];
    expectedResourceTypes?: string[];
    expectedResourceUrls?: string[];
  };
}

// ============================================================================
// Evaluation Task Result - Clean interface for metric evaluation
// ============================================================================

/**
 * Resource shape expected by RAGRetrievalMetric
 */
export interface EvaluationResource {
  title: string;
  url: string;
}

/**
 * Data required by built-in LLM-as-judge metrics (Hallucination, AnswerRelevance, Usefulness)
 * These are top-level fields that Opik's built-in metrics expect.
 */
export interface LLMJudgeMetricData {
  /** The prompt/question sent to the agent */
  input: string;
  /** The agent's response (JSON stringified) */
  output: string;
  /** Context strings for grounding evaluation */
  context: string[];
}

/**
 * Data required by StructuredOutputMetric
 */
export interface StructuredOutputMetricData {
  /** The raw output object to validate */
  rawOutput: unknown;
  /** Zod schema to validate against */
  schema: z.ZodSchema;
  /** Human-readable schema name for error messages */
  schemaName: string;
}

/**
 * Data required by ResponseTimeMetric
 */
export interface ResponseTimeMetricData {
  /** Agent response time in milliseconds */
  responseTimeMs: number;
}

/**
 * Data required by RAGRetrievalMetric
 */
export interface RAGRetrievalMetricData {
  /** Resources returned by the agent */
  resources: EvaluationResource[];
  /** Minimum number of resources expected */
  minResourceCount: number;
  /** Optional: specific URLs expected to be retrieved */
  expectedResourceUrls?: string[];
}

/**
 * Unified evaluation task result interface.
 * Separates data by metric concern for clarity and extensibility.
 *
 * To add a new metric:
 * 1. Define a new metric data interface above
 * 2. Add it to the appropriate section below
 * 3. Update tasks to provide the required data
 */
export interface EvaluationTaskResult {
  // -------------------------------------------------------------------------
  // Built-in LLM-as-judge metrics (Hallucination, AnswerRelevance, Usefulness)
  // These must be top-level fields as required by Opik
  // -------------------------------------------------------------------------
  input: string;
  output: string;
  context: string[];

  // -------------------------------------------------------------------------
  // Custom metrics - taskOutput contains agent output data
  // -------------------------------------------------------------------------
  taskOutput: {
    /** For StructuredOutputMetric */
    rawOutput: unknown;
    /** For ResponseTimeMetric (optional - only needed if using ResponseTimeMetric) */
    responseTimeMs?: number;
    /** For RAGRetrievalMetric (optional - only needed if using RAGRetrievalMetric) */
    resources?: EvaluationResource[];
  };

  // -------------------------------------------------------------------------
  // Custom metrics - reference contains expected/ground truth data
  // -------------------------------------------------------------------------
  reference: {
    /** For StructuredOutputMetric */
    schema: z.ZodSchema;
    schemaName: string;
    /** For RAGRetrievalMetric (optional - only needed if using RAGRetrievalMetric) */
    minResourceCount?: number;
    expectedResourceUrls?: string[];
  };
}

// ============================================================================
// Helper Types
// ============================================================================

export interface MetricResult {
  name: string;
  score: number;
  reason?: string;
}
