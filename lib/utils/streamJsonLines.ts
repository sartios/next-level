import { AIMessageChunk } from '@langchain/core/messages';
import { z } from 'zod';

/**
 * Parses a streaming LLM response that outputs JSON Lines format.
 * Buffers incoming chunks and yields validated objects as they complete.
 */
export async function* parseJsonLinesStream<T>(stream: AsyncIterable<AIMessageChunk>, schema: z.ZodSchema<T>): AsyncGenerator<T> {
  let buffer = '';

  for await (const chunk of stream) {
    const content = chunk.content;
    if (typeof content !== 'string') continue;

    buffer += content;

    // Try to extract complete JSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const parsed = tryParseJsonLine(line, schema);
      if (parsed !== null) {
        yield parsed;
      }
    }
  }

  // Process any remaining content in buffer
  const parsed = tryParseJsonLine(buffer, schema);
  if (parsed !== null) {
    yield parsed;
  }
}

/**
 * Attempts to parse a single line as JSON and validate against schema.
 * Returns null if parsing or validation fails.
 */
function tryParseJsonLine<T>(line: string, schema: z.ZodSchema<T>): T | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const validated = schema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // Invalid JSON, skip
  }

  return null;
}
