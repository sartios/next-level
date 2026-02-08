import { Opik, Trace, Span } from 'opik';

export type { Trace, Span };

export interface OpikHandlerOptions {
  tags?: string[];
  metadata?: Record<string, unknown>;
  threadId?: string;
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
