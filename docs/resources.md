# Learning Resources

Curated learning resources power the resource retrieval and challenge generation flows.

See also: [agents](agents.md) | [embeddings](embeddings.md) (semantic search) | [architecture](architecture.md).

## Supported Domains

The app currently ships curated resources for two career tracks:

| Track              | Focus Areas                                                          |
| ------------------ | -------------------------------------------------------------------- |
| Software Engineers | Web development, mobile, security, blockchain                        |
| Designers          | UI/UX, Figma, design systems, typography, usability, design thinking |

Resources come from providers such as Codecademy, Coursera, YouTube, Udemy, Skillshare, Domestika, and O'Reilly.

## Resource Schema

Each resource contains:

| Field                | Type      | Required | Description                                   |
| -------------------- | --------- | -------- | --------------------------------------------- |
| `url`                | string    | yes      | Unique URL (used for deduplication)           |
| `title`              | string    | yes      | Resource title                                |
| `provider`           | string    | yes      | Platform or publisher                         |
| `resourceType`       | enum      | yes      | `course` \| `book` \| `tutorial` \| `article` |
| `description`        | string    | no       | Summary of the resource                       |
| `learningObjectives` | string[]  | no       | What the learner will achieve                 |
| `targetAudience`     | string[]  | no       | Who the resource is for                       |
| `totalHours`         | number    | no       | Estimated completion time                     |
| `sections`           | Section[] | no       | Chapters/modules with title, duration, topics |

Validated at import time.

## How Resources Are Used

```
JSON data files (lib/resources/data/)
  → Import & embed (npm run resources:sync)
    → learning_resources + learning_resource_sections tables
    → resource_embeddings table (pgvector, 1536 dims)

User selects a goal
  → SkillResourceRetrieverAgent generates search queries (LLM)
    → Semantic search over embeddings (searchCuratedResources)
      → Returns ranked, deduplicated resources
        → User picks a resource

User picks a resource
  → ChallengeGeneratorAgent generates quiz questions per section
    → 10 questions per section/difficulty (easy → medium → hard)
```

### 1. Import & Embeddings

`npm run resources:sync` discovers all JSON files in `lib/resources/data/`, validates them, inserts into the database, and generates multi-level embeddings:

- **Full resource** — title + description + objectives + audience + sections combined
- **Description** — resource description alone
- **Learning objectives** — one embedding per objective
- **Target audience** — one embedding per audience segment
- **Sections** — title + topics per section

This multi-level strategy lets the `SkillResourceRetrieverAgent` match on skills, roles, topics, or broad course descriptions.

### 2. Retrieval

The `SkillResourceRetrieverAgent` uses the user's profile and goal to generate up to 5 search queries, then runs each against pgvector embeddings. Results are deduplicated and capped at 5 resources. See [embeddings](embeddings.md) for search details.

### 3. Challenge Generation

Once a user selects a resource for a goal, the `ChallengeGeneratorAgent` generates 10 multiple-choice questions per section at the current difficulty level. Challenges unlock progressively: easy first, then medium, then hard. See [agents](agents.md#challengegeneratoragent) for the full flow.

## Adding a New Domain

To support a new career track:

1. Create a JSON file in `lib/resources/data/` (e.g. `product-manager.json`) following the schema above
2. Run `npm run resources:sync` to import and generate embeddings
3. The retrieval agent will automatically include the new resources in semantic search results

No code changes are needed — the import pipeline auto-discovers all JSON files in the data directory.

## Commands

```bash
npm run resources:sync                                    # Import all JSON files + generate embeddings
npm run resources:sync -- --dry-run                       # Validate without importing
npx tsx scripts/importResources.ts --file <path>          # Import a single file
npx tsx scripts/importResources.ts --file <path> --validate-only  # Validate only
```

## Key Files

| File                                      | Purpose                                |
| ----------------------------------------- | -------------------------------------- |
| `lib/resources/data/*.json`               | Curated resource datasets              |
| `lib/resources/importer.ts`               | Import logic + embedding generation    |
| `lib/db/resourceRepository.ts`            | Resource CRUD                          |
| `lib/db/embeddingRepository.ts`           | Embedding storage + similarity search  |
| `lib/tools/searchCuratedResourcesTool.ts` | Semantic search tool for agents        |
| `lib/validation/schemas.ts`               | `ImportResourceSchema` + related types |
| `scripts/syncResources.ts`                | CLI for batch sync                     |
