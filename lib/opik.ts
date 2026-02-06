import { Opik, Trace, Span } from 'opik';
import { OpikCallbackHandler } from 'opik-langchain';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import type { Serialized } from '@langchain/core/load/serializable';
import type { BaseMessage } from '@langchain/core/messages';

export type { Trace, Span };

export class LLMUsageCapture extends BaseCallbackHandler {
  name = 'llm-usage-capture';
  awaitHandlers = true;
  usage?: Record<string, number>;
  model?: string;
  provider?: string;
  prompts?: Array<{ role: string; content: string }>;
  invocationParams?: Record<string, unknown>;
  generations?: string[];

  handleChatModelStart(
    _llm: Serialized,
    _messages: BaseMessage[][],
    _runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>
  ) {
    if (metadata?.ls_model_name) this.model = metadata.ls_model_name as string;
    if (metadata?.ls_provider) this.provider = metadata.ls_provider as string;
    this.prompts = _messages.flat().map((m) => ({
      role: m.type,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));
    this.invocationParams = extraParams?.invocation_params as Record<string, unknown>;
  }

  handleLLMEnd(output: LLMResult) {
    const tokenUsage =
      (output.llmOutput?.tokenUsage as Record<string, number>) || (output.llmOutput?.estimatedTokenUsage as Record<string, number>) || {};
    this.usage = {
      prompt_tokens: tokenUsage.promptTokens,
      completion_tokens: tokenUsage.completionTokens,
      total_tokens: tokenUsage.totalTokens
    };
    this.generations = output.generations?.flat().map((g) => g.text);
  }
}

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
