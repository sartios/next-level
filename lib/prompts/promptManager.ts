import assert from 'assert';
import { Opik, Prompt } from 'opik';

import { AGENT_PROMPTS, AgentPromptName } from './agentPrompts';

let opikClient: Opik | null = null;

function getOpikClient(): Opik {
  if (!opikClient) {
    assert(process.env.OPIK_PROJECT_NAME, 'Expected environment variable OPIK_PROJECT_NAME not found');
    opikClient = new Opik({
      projectName: process.env.OPIK_PROJECT_NAME
    });
  }
  return opikClient;
}

// Cache for prompts to avoid repeated API calls
const promptCache: Map<string, { prompt: Prompt; timestamp: number }> = new Map();
const FIVE_MINUTES = 5 * 60 * 1000;
const CACHE_TTL_MS = FIVE_MINUTES;

/**
 * Get a prompt from Opik by name.
 * Falls back to local definition if Opik is unavailable.
 */
export async function getAgentPrompt(name: AgentPromptName): Promise<string> {
  const localPrompt = AGENT_PROMPTS[name];

  const cached = promptCache.get(name);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.prompt.prompt;
  }

  try {
    const client = getOpikClient();
    const prompt = await client.getPrompt({ name });

    if (prompt) {
      promptCache.set(name, { prompt, timestamp: Date.now() });
      return prompt.prompt;
    }
  } catch (error) {
    console.warn(`Failed to fetch prompt "${name}" from Opik, using local fallback:`, error);
  }

  return localPrompt.prompt;
}

/**
 * Sync all local prompts to Opik.
 * Creates new prompts or updates existing ones.
 */
export async function syncPromptsToOpik(): Promise<void> {
  const client = getOpikClient();

  for (const [name, promptDef] of Object.entries(AGENT_PROMPTS)) {
    try {
      console.log(`Syncing prompt: ${name}`);

      const prompt = await client.createPrompt({
        name: promptDef.name,
        prompt: promptDef.prompt,
        metadata: promptDef.metadata
      });

      console.log(`  Created/updated prompt: ${prompt.name} (commit: ${prompt.commit})`);
    } catch (error) {
      console.error(`  Failed to sync prompt "${name}":`, error);
    }
  }

  console.log('Prompt sync complete');

  promptCache.clear();
  console.log('Prompt cache cleared');
}
