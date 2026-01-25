import { OpikCallbackHandler } from 'opik-langchain';

/**
 * Factory function to create a new Opik callback handler
 * with optional tags and metadata for each agent.
 */
export function createOpikHandler(options?: { tags?: string[]; metadata?: Record<string, unknown> }) {
  return new OpikCallbackHandler({
    projectName: process.env.OPIK_PROJECT_NAME!,
    tags: (options?.tags || []) as [],
    metadata: { environment: process.env.NODE_ENV, version: '1.0.0', ...options?.metadata }
  });
}
