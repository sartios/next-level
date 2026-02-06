# Opik Integration

Next Level uses [Opik](https://www.comet.com/docs/opik/) for full LLM observability: tracing, prompt management, and evaluations.

## What We Trace

Every LLM call captures: **prompts**, **generations**, **model**, **provider**, **token usage**, and **invocation params** — all fed into hierarchical Opik traces via a custom `LLMUsageCapture` callback handler.

## Environment Variables

| Variable            | Description                                 |
| ------------------- | ------------------------------------------- |
| `OPIK_API_KEY`      | Opik API key (tracing disabled when absent) |
| `OPIK_WORKSPACE`    | Opik workspace                              |
| `OPIK_PROJECT_NAME` | Project for traces and prompts              |

## Tracing Architecture

Manual traces via the `opik` SDK give us hierarchical parent→child visibility. A custom `LLMUsageCapture` handler hooks into LangChain's callback system to capture LLM metadata without creating duplicate traces (unlike `OpikCallbackHandler` which creates its own).

```typescript
const trace = createAgentTrace('agent-name', 'operation', { input, metadata, tags });
const llmSpan = trace?.span({ name: 'llm-call', type: 'llm' });

const usageCapture = new LLMUsageCapture();
const stream = await llm.stream(messages, { callbacks: [usageCapture] });
// ... process stream ...

llmSpan?.update({
  input: { prompts: usageCapture.prompts },
  output: { generations: usageCapture.generations },
  metadata: { invocationParams: usageCapture.invocationParams },
  model: usageCapture.model,
  provider: usageCapture.provider,
  usage: usageCapture.usage,
  endTime: new Date()
});
```

### `LLMUsageCapture` captures

| Field              | Source                             | Example                         |
| ------------------ | ---------------------------------- | ------------------------------- |
| `model`            | `handleChatModelStart` metadata    | `gpt-5-mini`                    |
| `provider`         | `handleChatModelStart` metadata    | `openai`                        |
| `prompts`          | `handleChatModelStart` messages    | `[{ role: 'system', content }]` |
| `invocationParams` | `handleChatModelStart` extraParams | `{ temperature, stream, ... }`  |
| `usage`            | `handleLLMEnd` llmOutput           | `{ prompt_tokens: 215, ... }`   |
| `generations`      | `handleLLMEnd` generations         | `["raw LLM output text"]`       |

## Trace Hierarchies

### UserSkillAgent — `streamSkillSuggestions()`

```
[Trace] user-skill-agent:stream
  └── [Span:llm] skill-suggestion-llm
```

### SkillResourceRetrieverAgent — `streamResources()`

```
[Trace] skill-resource-retriever-agent:stream
  ├── [Span:llm]  query-generation
  ├── [Span:tool] search-curated-resources  ← query 1
  ├── [Span:tool] search-curated-resources  ← query 2
  └── [Span:tool] search-curated-resources  ← query N
```

### ChallengeGeneratorAgent — `generateAllChallengesForGoal()`

```
[Trace] challenge-generator-agent:generate-all
  ├── [Span:general] process-challenge:<section>:easy
  │    └── [Span:llm] generate-questions:<section>
  ├── [Span:general] process-challenge:<section>:medium
  │    └── [Span:llm] generate-questions:<section>
  └── ...
```

## Prompt Management

Prompts are managed through Opik and fetched at runtime with local fallback and 5-minute caching.

```typescript
const prompt = await getAgentPrompt('agent-name:prompt-key', { variableName: 'value' });
```

```bash
npm run prompts:sync  # Push local prompts to Opik
```

## Evaluations

```bash
npm run evals
```

Runs agents against test datasets and scores with LLM-as-a-judge metrics:

- **Hallucination** — Is the output grounded in context?
- **AnswerRelevance** — Is the output relevant to the input?
- **Usefulness** — Is the output useful for the user?

Results are stored as Opik experiments linked to their datasets.
