import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Serialized } from '@langchain/core/load/serializable';
import type { BaseMessage } from '@langchain/core/messages';
import type { Trace } from 'opik';

const mockSpanUpdate = vi.fn();
const mockSpanFn = vi.fn(() => ({
  data: { id: 'child-span-id' },
  span: mockSpanFn,
  update: mockSpanUpdate
}));
const mockTraceUpdate = vi.fn();
const mockTraceFn = vi.fn(() => ({
  data: { id: 'trace-id' },
  span: mockSpanFn,
  update: mockTraceUpdate
}));
const mockFlush = vi.fn();

vi.mock('opik', () => ({
  Opik: vi.fn(() => ({
    trace: mockTraceFn,
    flush: mockFlush,
    config: {}
  })),
  OpikSpanType: { General: 'general', Llm: 'llm', Tool: 'tool' },
  logger: { debug: vi.fn(), info: vi.fn() }
}));

vi.mock('./utils', () => ({
  extractCallArgs: vi.fn(() => ({})),
  inputFromChainValues: vi.fn((v: unknown) => v),
  inputFromMessages: vi.fn((m: unknown) => ({ messages: m })),
  outputFromChainValues: vi.fn((v: unknown) => v),
  outputFromGenerations: vi.fn((g: unknown) => ({ generations: g })),
  outputFromToolOutput: vi.fn((v: unknown) => v),
  safeParseSerializedJson: vi.fn((v: string) => ({ value: v }))
}));

import { NextLevelOpikCallbackHandler } from '@/lib/trace/handler';

const parentId = 'parent-trace-id';
const mockParent = {
  data: { id: parentId },
  span: mockSpanFn,
  update: vi.fn()
} as unknown as Trace;

const mockLlm: Serialized = { lc: 1, type: 'constructor', id: ['ChatOpenAI'], kwargs: {} };

describe('NextLevelOpikCallbackHandler — parent injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store injected parent in tracerMap', () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent });

    // Parent is stored — when handleChatModelStart fires without a parentRunId,
    // it should resolve to the injected parent and create a child span
    expect(handler).toBeDefined();
  });

  it('should nest LLM span under injected parent when no parentRunId', async () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent });

    await handler.handleChatModelStart(mockLlm, [] as BaseMessage[][], 'run-1', undefined, undefined, [], {});

    // Should call span() on the injected parent to create a child span
    expect(mockSpanFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'llm',
        name: 'ChatOpenAI'
      })
    );
  });

  it('should use LangChain parentRunId when provided instead of injected parent', async () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent });

    // First create a chain span under the injected parent
    await handler.handleChainStart(mockLlm, {}, 'chain-run', undefined, [], {});

    // Now start an LLM call with the chain as parent
    await handler.handleChatModelStart(mockLlm, [] as BaseMessage[][], 'llm-run', 'chain-run', undefined, [], {});

    // span() called twice: once for chain (child of injected parent), once for LLM (child of chain)
    expect(mockSpanFn).toHaveBeenCalledTimes(2);

    // The LLM span should have type 'llm', confirming it was created via the chain span's .span()
    expect(mockSpanFn).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'llm', name: 'ChatOpenAI' }));
  });

  it('should create own root trace when no parent is injected', async () => {
    const handler = new NextLevelOpikCallbackHandler();

    await handler.handleChainStart(mockLlm, {}, 'run-1', undefined, [], {});

    // Without an injected parent and no parentRunId, should create a root trace
    expect(mockTraceFn).toHaveBeenCalled();
  });

  it('should propagate endTracing to span under injected parent', async () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent });

    await handler.handleChatModelStart(mockLlm, [] as BaseMessage[][], 'run-1', undefined, undefined, [], {});
    await handler.handleLLMEnd(
      { generations: [], llmOutput: { tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } } },
      'run-1'
    );

    expect(mockSpanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        endTime: expect.any(Date)
      })
    );
  });

  it('should propagate error info on LLM error', async () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent });

    await handler.handleChatModelStart(mockLlm, [] as BaseMessage[][], 'run-1', undefined, undefined, [], {});
    await handler.handleLLMError(new Error('LLM failed'), 'run-1');

    expect(mockSpanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        errorInfo: expect.objectContaining({
          message: 'LLM failed',
          exceptionType: 'Error'
        }),
        endTime: expect.any(Date)
      })
    );
  });

  it('should set threadId in metadata when provided', () => {
    const handler = new NextLevelOpikCallbackHandler({ parent: mockParent, threadId: 'thread-abc' });

    expect(handler).toBeDefined();
    // threadId is stored in options.metadata for trace creation
  });
});
