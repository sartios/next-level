# Embeddings Architecture

## Overview

Semantic search over curated learning resources using OpenAI embeddings + PostgreSQL pgvector.

## Configuration

| Parameter            | Value                    |
| -------------------- | ------------------------ |
| Model                | `text-embedding-3-small` |
| Dimensions           | 1536                     |
| Batch Size           | 100                      |
| Text Truncation      | 30,000 chars             |
| Similarity Threshold | 0.5                      |

## Embedding Creation (`lib/embeddings/index.ts`)

- `createEmbedding(text)` — single text → `number[]`
- `createEmbeddings(texts)` — batch texts → `number[][]`, processes in groups of 100
- Singleton `OpenAIEmbeddings` client, auto-truncates text to 30k chars

## Database Schema (`lib/db/schema.ts`)

Table `resource_embeddings`:

- `id` (UUID PK), `resourceId` (FK → `learning_resources`), `sectionId` (FK → `learning_resource_sections`, nullable)
- `contentType`: `'resource'` | `'description'` | `'learning_objective'` | `'target_audience'` | `'section'`
- `contentIndex` (for array items like multiple objectives)
- `contentText` (original text), `embedding` (vector(1536))

Relations:

```
learningResources (1) → many(resourceEmbeddings)
learningResourceSections (1) → many(resourceEmbeddings)
```

## Storage & Search (`lib/db/embeddingRepository.ts`)

**Write:**

- `insertResourceEmbedding()` — single insert
- `insertResourceEmbeddings()` — batch insert

**Search (pgvector cosine distance `<=>`):**

- `searchEmbeddings(queryEmbedding, options)` — generic search with optional content type filter
- `getUniqueResourcesFromResults()` — deduplicates by resource ID, keeps best similarity score

## Resource Import Pipeline (`lib/resources/importer.ts`)

When a resource is imported, multiple embeddings are generated:

1. **Full resource** — combined title, provider, type, description, objectives, audience, sections, topics
2. **Description** — if present
3. **Learning objectives** — one embedding per objective (with `contentIndex`)
4. **Target audience** — one embedding per audience type (with `contentIndex`)
5. **Sections** — one per section, combining title + topics (with `sectionId`)

Flow: `importResourcesFromJson()` → `importSingleResource()` → `prepareEmbeddingItems()` → `createEmbeddings()` → `insertResourceEmbeddings()`

## Search Tool (`lib/tools/searchCuratedResourcesTool.ts`)

- `searchCuratedResources(query, limit)` — embeds query, searches with 2x limit for dedup headroom, filters by similarity ≥ 0.5, returns unique resources
- `searchCuratedResourcesTool` — LangChain tool wrapper for agent use

## Agent Usage

**SkillResourceRetrieverAgent** (`lib/agents/SkillResourceRetrieverAgent.ts`):

1. LLM generates 5 search queries based on user profile/goals
2. Each query → `searchCuratedResources(query, 3)`
3. Deduplicates across queries, streams up to 5 resources via SSE

API: `GET /api/users/[id]/goals/[goalId]/resources/stream`

## End-to-End Flow

```
User Query
  → SkillResourceRetrieverAgent generates search queries (LLM)
    → searchCuratedResources(query)
      → createEmbedding(query) → OpenAI API
      → searchEmbeddings(vector) → PostgreSQL pgvector
      → getUniqueResourcesFromResults() → deduplicated results
  → Stream resources to client (SSE)
```
