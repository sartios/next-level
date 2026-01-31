import { OpenAIEmbeddings } from '@langchain/openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;

let embeddingsClient: OpenAIEmbeddings | null = null;

function getEmbeddingsClient(): OpenAIEmbeddings {
  if (!embeddingsClient) {
    embeddingsClient = new OpenAIEmbeddings({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS
    });
  }
  return embeddingsClient;
}

function truncateText(text: string, maxChars: number = 30000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getEmbeddingsClient();
  const truncatedTexts = texts.map((t) => truncateText(t));

  const results: number[][] = [];
  for (let i = 0; i < truncatedTexts.length; i += BATCH_SIZE) {
    const batch = truncatedTexts.slice(i, i + BATCH_SIZE);
    const embeddings = await client.embedDocuments(batch);
    results.push(...embeddings);
  }

  return results;
}
