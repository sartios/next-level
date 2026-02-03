import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';

interface AgentContext {
  [key: string]: string;
}

/**
 * Creates an Opik handler with standardized tagging for agents.
 */
export function createAgentOpikHandler(
  agentName: string,
  operation: string,
  contextMetadata: AgentContext,
  opikOptions?: OpikHandlerOptions
) {
  return createOpikHandler({
    tags: [agentName, `operation:${operation}`, ...(opikOptions?.tags || [])],
    metadata: {
      agentName,
      ...contextMetadata,
      ...opikOptions?.metadata
    },
    threadId: opikOptions?.threadId
  });
}
