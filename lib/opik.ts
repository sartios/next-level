import { Opik, Trace, Span } from 'opik';
import { OpikCallbackHandler } from 'opik-langchain';

export type { Trace, Span };

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

let opikClient: Opik | null = null;

export function getOpikClient(): Opik | null {
  if (!process.env.OPIK_API_KEY) {
    return null;
  }
  if (!opikClient) {
    opikClient = new Opik({
      projectName: process.env.OPIK_PROJECT_NAME
    });
  }
  return opikClient;
}

export function createAgentTrace(
  agentName: string,
  operation: string,
  options?: {
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tags?: string[];
    threadId?: string;
  }
): Trace | null {
  const client = getOpikClient();
  if (!client) return null;

  return client.trace({
    name: `${agentName}:${operation}`,
    input: options?.input,
    metadata: {
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      agentName,
      ...options?.metadata
    },
    tags: [agentName, `operation:${operation}`, ...(options?.tags || [])],
    threadId: options?.threadId
  });
}
