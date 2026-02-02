import { ChatOpenAI } from '@langchain/openai';

export type ModelName = 'gpt-4o-mini' | 'gpt-5-nano' | 'gpt-5-mini';

/**
 * Creates an LLM instance with standard configuration.
 */
export function createLLM(model: ModelName, streaming = false) {
  return new ChatOpenAI({ model, streaming });
}

/**
 * Creates a streaming LLM instance.
 */
export function createStreamingLLM(model: ModelName) {
  return createLLM(model, true);
}
