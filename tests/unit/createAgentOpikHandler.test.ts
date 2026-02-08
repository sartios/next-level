import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/opik', () => ({
  createOpikHandler: vi.fn()
}));

import { createOpikHandler } from '@/lib/opik';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';

const mockCreateOpikHandler = vi.mocked(createOpikHandler);

describe('createAgentOpikHandler', () => {
  it('should create handler with agent name and operation tags', () => {
    createAgentOpikHandler('my-agent', 'suggest', { userId: 'u1' });

    expect(mockCreateOpikHandler).toHaveBeenCalledWith({
      tags: ['my-agent', 'operation:suggest'],
      metadata: { agentName: 'my-agent', userId: 'u1' },
      threadId: undefined
    });
  });

  it('should merge additional opik tags', () => {
    createAgentOpikHandler('my-agent', 'generate', { goalId: 'g1' }, { tags: ['extra-tag'] });

    expect(mockCreateOpikHandler).toHaveBeenCalledWith({
      tags: ['my-agent', 'operation:generate', 'extra-tag'],
      metadata: { agentName: 'my-agent', goalId: 'g1' },
      threadId: undefined
    });
  });

  it('should merge additional opik metadata', () => {
    createAgentOpikHandler('my-agent', 'retrieve', { userId: 'u1' }, { metadata: { custom: 'value' } });

    expect(mockCreateOpikHandler).toHaveBeenCalledWith({
      tags: ['my-agent', 'operation:retrieve'],
      metadata: { agentName: 'my-agent', userId: 'u1', custom: 'value' },
      threadId: undefined
    });
  });

  it('should pass threadId when provided', () => {
    createAgentOpikHandler('my-agent', 'suggest', { userId: 'u1' }, { threadId: 'thread-123' });

    expect(mockCreateOpikHandler).toHaveBeenCalledWith({
      tags: ['my-agent', 'operation:suggest'],
      metadata: { agentName: 'my-agent', userId: 'u1' },
      threadId: 'thread-123'
    });
  });

  it('should use empty tags when opikOptions has no tags', () => {
    createAgentOpikHandler('my-agent', 'suggest', {}, { metadata: { foo: 'bar' } });

    const call = mockCreateOpikHandler.mock.calls[0][0];
    expect(call?.tags).toEqual(['my-agent', 'operation:suggest']);
  });
});
