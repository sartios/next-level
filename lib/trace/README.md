# NextLevelOpikCallbackHandler

Forked from the [opik-langchain callback handler](https://github.com/comet-ml/opik/tree/main/sdks/typescript/src/opik/integrations/opik-langchain) and extended with parent injection support.

## Why the Fork?

The built-in `OpikCallbackHandler` creates its own root traces, making it impossible to nest LangChain spans under an existing manual trace. This forked handler adds **parent injection** — pass an existing `Trace` or `Span` and all LangChain lifecycle events nest underneath it, giving a single unified trace hierarchy instead of duplicates.

## Architecture

```
lib/trace/
  handler.ts   — NextLevelOpikCallbackHandler (main class)
  utils.ts     — Input/output parsing, serialization helpers
  types.ts     — Shared type definitions (JSON types, container interfaces)
```

## Usage

```typescript
import { NextLevelOpikCallbackHandler } from '@/lib/trace/handler';

// Create with an existing parent trace or span
const handler = new NextLevelOpikCallbackHandler({ parent: myTrace });

// Pass as a LangChain callback
const stream = await llm.stream(messages, { callbacks: [handler] });
```

## How It Works

The handler maintains a `tracerMap` that tracks active spans by LangChain's `runId`. When a lifecycle event fires:

1. **Start events** (`handleChatModelStart`, `handleChainStart`, etc.) call `startTracing()` which creates a new Opik span as a child of the resolved parent.
2. **End events** (`handleLLMEnd`, `handleChainEnd`, etc.) call `endTracing()` which updates the span with output, usage data, and an end timestamp.
3. **Error events** (`handleLLMError`, `handleToolError`, etc.) call `endTracing()` with error info attached.

### Parent Resolution

Every start event calls `resolveParentId(parentRunId)` which returns either:

- The `parentRunId` provided by LangChain (for nested calls), or
- The injected parent's ID (for top-level calls that would otherwise create a new root trace)

This ensures all spans land under the injected parent rather than creating duplicate root traces.

## Supported LangChain Events

| Event                      | Span Type | Data Captured                          |
| -------------------------- | --------- | -------------------------------------- |
| `handleChatModelStart/End` | LLM       | Messages, model, provider, token usage |
| `handleLLMStart/End`       | LLM       | Prompts, model params, token usage     |
| `handleChainStart/End`     | General   | Chain inputs/outputs                   |
| `handleToolStart/End`      | Tool      | Tool input (JSON parsed), output       |
| `handleAgentAction/End`    | General   | Action tool name, finish output        |
| `handleRetrieverStart/End` | Tool      | Query, retrieved documents             |
| `*Error` variants          | —         | Error info (message, type, stack)      |

## Token Usage Extraction

`handleLLMEnd` extracts token usage from LangChain's `llmOutput`, checking both `tokenUsage` (from `.stream()`) and `estimatedTokens` (from `.invoke()` with internal streaming). The usage is forwarded to Opik as `prompt_tokens`, `completion_tokens`, and `total_tokens`.

## Utilities (`utils.ts`)

Parsing helpers that normalize LangChain's various input/output formats into clean JSON for Opik:

- `inputFromMessages` — Converts `BaseMessage[][]` to `{ messages: [...] }` with role mapping
- `inputFromChainValues` / `outputFromChainValues` — Recursively parses chain values, handling `content`, `messages`, `value`, and `kwargs` containers
- `outputFromGenerations` — Extracts generation content from LLM responses
- `outputFromToolOutput` — Handles `ToolMessage` instances
- `extractCallArgs` — Extracts model parameters (temperature, top_p, max_tokens, etc.) from invocation params and metadata
- `safeParseSerializedJson` — Safely parses JSON strings with fallback
- `cleanObject` — Strips null, undefined, and empty values from objects
