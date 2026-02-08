import { describe, it, expect, vi } from 'vitest';

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn()
}));

import { ChatOpenAI } from '@langchain/openai';
import { createLLM, createStreamingLLM } from '@/lib/utils/llm';

const mockChatOpenAI = vi.mocked(ChatOpenAI);

describe('createLLM', () => {
  it('should create a ChatOpenAI instance with the given model', () => {
    createLLM('gpt-5-nano');

    expect(mockChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-5-nano', streaming: false });
  });

  it('should create a non-streaming instance by default', () => {
    createLLM('gpt-4o-mini');

    expect(mockChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-4o-mini', streaming: false });
  });

  it('should create a streaming instance when streaming is true', () => {
    createLLM('gpt-5-mini', true);

    expect(mockChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-5-mini', streaming: true });
  });
});

describe('createStreamingLLM', () => {
  it('should create a streaming ChatOpenAI instance', () => {
    createStreamingLLM('gpt-5-mini');

    expect(mockChatOpenAI).toHaveBeenCalledWith({ model: 'gpt-5-mini', streaming: true });
  });
});
