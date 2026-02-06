# Opik Integration

Next Level uses [Opik](https://www.comet.com/docs/opik/) for full LLM observability: tracing, prompt management, and evaluations.

## What We Trace

Every LLM call captures: **prompts**, **generations**, **model**, **provider**, **token usage**, and **invocation params** — all fed into hierarchical Opik traces via `NextLevelOpikCallbackHandler`.

## Environment Variables

| Variable            | Description                                 |
| ------------------- | ------------------------------------------- |
| `OPIK_API_KEY`      | Opik API key (tracing disabled when absent) |
| `OPIK_WORKSPACE`    | Opik workspace                              |
| `OPIK_PROJECT_NAME` | Project for traces and prompts              |

## Tracing Architecture

### `NextLevelOpikCallbackHandler` (`lib/trace/handler.ts`)

Custom LangChain `BaseCallbackHandler` (forked from `opik-langchain`) that handles all tracing. Key feature: **parent injection** — accepts an existing `Trace` or `Span` and nests all LangChain-generated spans under it, avoiding the duplicate traces that the built-in `OpikCallbackHandler` creates.

```typescript
const trace = createAgentTrace('agent-name', 'operation', { input, metadata, tags });
const llmSpan = trace?.span({ name: 'llm-call', type: 'llm' });

const traceHandler = new NextLevelOpikCallbackHandler({ parent: llmSpan });

try {
  const stream = await llm.stream(messages, { callbacks: [traceHandler] });
  // ... process stream ...
} catch (error) {
  llmSpan?.update({ errorInfo: { ... }, endTime: new Date() });
  throw error;
}

llmSpan?.update({ output: { ... }, endTime: new Date() });
```

Handles all LangChain lifecycle events: `handleChatModelStart`, `handleLLMEnd`, `handleChainStart/End`, `handleToolStart/End`, `handleRetrieverStart/End`, `handleAgentAction/End`.

### `createOpikHandler` (`lib/opik.ts`)

Factory for the **built-in** `OpikCallbackHandler` from `opik-langchain`. Only used for standalone LangChain agent calls where auto-created traces are acceptable. Do not mix with manual parent traces.

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

## Evaluations (LLM-as-Judge)

Runs agents against test datasets and scores output quality using Opik's built-in LLM-as-judge metrics. Judge model: **`gpt-5-mini`**.

### Metrics

| Metric              | What it checks                                      |
| ------------------- | --------------------------------------------------- |
| **Hallucination**   | Is the output grounded in context (not fabricated)? |
| **AnswerRelevance** | Is the output relevant to the input prompt?         |
| **Usefulness**      | Is the output practically useful for the user?      |

### Evaluated Agents

| CLI key                    | Agent                       | Dataset                                              |
| -------------------------- | --------------------------- | ---------------------------------------------------- |
| `user-skill-agent`         | UserSkillAgent              | `evals/datasets/user-skill-agent.json`               |
| `skill-resource-retriever` | SkillResourceRetrieverAgent | `evals/datasets/skill-resource-retriever-agent.json` |
| `challenge-generator`      | ChallengeGeneratorAgent     | `evals/datasets/challenge-generator-agent.json`      |

### How it works

1. **Dataset loading** — Test fixtures from local JSON or the Opik platform (`--source opik`).
2. **DB seeding** — `evals/seed.ts` populates the database with test data so agents can run against real records.
3. **Task execution** — Each task function (`evals/tasks/*.ts`) calls the real agent and returns `{ input, output, context }` for the judges.
4. **Scoring** — Opik's `evaluate()` runs the three judge metrics against each task result.
5. **Results** — Stored as Opik experiments linked to their datasets, viewable in the Opik dashboard.

### Task function contract

Each task must return:

```typescript
{ input: string, output: string, context: string[] }
```

- `input` — The system prompt or instruction given to the agent.
- `output` — The agent's actual output (JSON stringified).
- `context` — Grounding facts for the Hallucination metric (user info, goal, resource details).

### CLI usage

```bash
npx tsx evals/run.ts --agent user-skill-agent                    # single agent
npx tsx evals/run.ts --all --samples 2                            # all agents, limit samples
npx tsx evals/run.ts --agent challenge-generator --source opik    # load from Opik platform
npx tsx evals/run.ts --all --verbose                              # detailed per-test output
```

Results are stored as Opik experiments linked to their datasets.
