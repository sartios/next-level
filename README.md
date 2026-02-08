# Next Level

Most new year's resolutions fail because people set ambitious goals without a clear plan to get there. Next Level turns career growth resolutions into actionable learning paths. Users define their role, current skills, and career goals, and LangChain agents take it from there: recommending skills to acquire, discovering curated learning resources via semantic search, and generating quiz challenges to reinforce knowledge. Adaptive weekly study plans are built around the user's availability without AI, using [algorithmic scheduling](docs/scheduling.md).

Built as part of the [Opik Hackathon](https://www.comet.com/site/opik/).

## Architecture

Next.js frontend streams responses from LangChain agents, backed by PostgreSQL with pgvector for semantic search. See [docs/architecture.md](docs/architecture.md) for the full diagram.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **AI/LLM:** LangChain, OpenAI (gpt-4o-mini, gpt-5-nano, gpt-5-mini), text-embedding-3-small — see [agents](docs/agents.md)
- **Database:** PostgreSQL with pgvector ([embeddings](docs/embeddings.md)), Drizzle ORM
- **Observability:** Opik (tracing, prompt management, LLM-as-judge evaluations)
- **Optimization:** opik-optimizer (MetaPromptOptimizer, Python)
- **Testing:** Vitest

## Opik Integration

This project uses [Opik](https://www.comet.com/site/opik/) across the full LLM development lifecycle:

- **Tracing** — Every agent call is traced with hierarchical parent/child spans via a custom LangChain callback handler, giving full visibility into LLM inputs, outputs, and token usage.
- **Prompt Management** — Agent prompts are versioned and managed in Opik. Prompts are fetched at runtime with a local fallback, enabling A/B testing and iteration without code changes.
- **LLM-as-Judge Evaluations** — Automated evaluation pipeline using Hallucination, AnswerRelevance, and Usefulness metrics with gpt-5-mini as the judge model.
- **Prompt Optimization** — Python-based `MetaPromptOptimizer` automatically improves agent prompts by evaluating candidates against Opik datasets.

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Python 3.11+ (for prompt optimization)
- OpenAI API key
- Opik API key

### Setup

1. Clone the repository and install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Copy the environment file and fill in your keys:

```bash
cp .env.example .env
```

3. Start the database and run migrations:

```bash
docker compose up -d
npm run db:migrate
```

4. Sync learning resources and generate embeddings:

```bash
npm run resources:sync
```

5. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### Prompt Optimization (Python)

```bash
cd optimize
python -m venv .venv
source .venv/bin/activate
pip install -e .
python run_all.py
```

## Scripts

| Command                            | Description                            |
| ---------------------------------- | -------------------------------------- |
| `npm run dev`                      | Start development server               |
| `npm run build`                    | Production build                       |
| `npm run lint`                     | Run ESLint                             |
| `npm test`                         | Run all tests                          |
| `npm run test:coverage`            | Test coverage report                   |
| `npm run db:migrate`               | Push schema to database                |
| `npm run db:studio`                | Open Drizzle Studio                    |
| `npm run prompts:sync`             | Sync prompts to Opik                   |
| `npm run resources:sync`           | Import resources + generate embeddings |
| `npm run eval:all`                 | Run all LLM-as-judge evaluations       |
| `cd optimize && python run_all.py` | Run all prompt optimizers              |

## Deployment

Deployed on [Vercel](https://vercel.com). The build step automatically runs database migrations and resource sync:

```bash
npm run build:vercel  # db:migrate + resources:sync + next build
```
