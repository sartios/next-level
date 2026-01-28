import { OpikCallbackHandler } from 'opik-langchain';

export interface OpikHandlerOptions {
  tags?: string[];
  metadata?: Record<string, unknown>;
  threadId?: string;
}

/**
 * Factory function to create a new Opik callback handler
 * with optional tags, metadata, and threadId for each agent.
 *
 * @param options.tags - Tags for categorization (e.g., ['agent:skill', 'operation:suggest'])
 * @param options.metadata - Custom metadata (e.g., userId, goalId, agentName)
 * @param options.threadId - Session/request ID to group related traces together
 */
export function createOpikHandler(options?: OpikHandlerOptions) {
  return new OpikCallbackHandler({
    projectName: process.env.OPIK_PROJECT_NAME!,
    tags: (options?.tags || []) as [],
    metadata: { environment: process.env.NODE_ENV, version: '1.0.0', ...options?.metadata },
    threadId: options?.threadId
  });
}
