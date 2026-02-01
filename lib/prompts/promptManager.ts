import { Opik, Prompt } from 'opik';

import { AGENT_PROMPTS, AgentPromptName } from './agentPrompts';

let opikClient: Opik | null = null;
/**
 * Get the Opik client instance.
 * Returns null if OPIK_PROJECT_NAME is not set.
 */
function getOpikClient(): Opik | null {
  if (!opikClient && process.env.OPIK_PROJECT_NAME) {
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
export async function getAgentPrompt(name: AgentPromptName, variables?: Record<string, unknown>): Promise<string> {
  const localPrompt = AGENT_PROMPTS[name];

  const cached = promptCache.get(name);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return variables ? cached.prompt.format(variables).trim() : cached.prompt.prompt.trim();
  }

  const client = getOpikClient();
  if (client) {
    try {
      const prompt = await client.getPrompt({ name });

      if (prompt) {
        promptCache.set(name, { prompt, timestamp: Date.now() });
        return variables ? prompt.format(variables).trim() : prompt.prompt.trim();
      }
    } catch (error) {
      console.warn(`Failed to fetch prompt "${name}" from Opik, using local fallback:`, error);
    }
  }

  return localPrompt.prompt.trim();
}

/**
 * Sync all local prompts to Opik.
 * Creates new prompts or updates existing ones.
 */
export async function syncPromptsToOpik(): Promise<void> {
  const client = getOpikClient();
  if (!client) {
    throw new Error('Cannot sync prompts: OPIK_PROJECT_NAME environment variable is not set');
  }

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
