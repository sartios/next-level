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

// Keys that could be used for prototype pollution attacks:
// - __proto__: Direct access to object's prototype; allows modifying Object.prototype
// - constructor: Access to constructor function; can modify prototype via constructor.prototype
// - prototype: Direct prototype property; modifying it affects all instances of a class
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitize variables before template substitution.
 * - Filters out dangerous keys that could cause prototype pollution
 * - Only allows alphanumeric keys with underscores (matching template pattern)
 * - Converts all values to strings to prevent object injection
 * @internal Exported for testing purposes
 */
export function sanitizeVariables(variables?: Record<string, unknown>): Record<string, string> | undefined {
  if (!variables) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(variables)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }

    // Only allow keys matching the template pattern (alphanumeric + underscore)
    if (!/^\w+$/.test(key)) {
      continue;
    }

    // Convert value to string safely
    sanitized[key] = String(value);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Substitute template variables in a prompt string.
 * Replaces {{variableName}} with the corresponding value from variables.
 * Uses single-pass replacement to prevent template injection attacks.
 * @internal Exported for testing purposes
 */
export function substituteVariables(template: string, variables?: Record<string, unknown>): string {
  if (!variables) {
    return template;
  }
  // Single-pass replacement using callback to prevent recursive substitution
  // This ensures values containing {{...}} are not processed as templates
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return match; // Keep original placeholder if no matching variable
  });
}

/**
 * Get a prompt from Opik by name.
 * Falls back to local definition if Opik is unavailable.
 * Variables are sanitized before use to prevent injection attacks.
 */
export async function getAgentPrompt(name: AgentPromptName, variables?: Record<string, unknown>): Promise<string> {
  const localPrompt = AGENT_PROMPTS[name];

  // Sanitize variables before any use (protects both Opik format() and local substituteVariables)
  const safeVariables = sanitizeVariables(variables);

  const cached = promptCache.get(name);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return safeVariables ? cached.prompt.format(safeVariables).trim() : cached.prompt.prompt.trim();
  }

  const client = getOpikClient();
  if (client) {
    try {
      const prompt = await client.getPrompt({ name });

      if (prompt) {
        promptCache.set(name, { prompt, timestamp: Date.now() });
        return safeVariables ? prompt.format(safeVariables).trim() : prompt.prompt.trim();
      }
    } catch (error) {
      console.warn(`Failed to fetch prompt "${name}" from Opik, using local fallback:`, error);
    }
  }

  return substituteVariables(localPrompt.prompt, safeVariables).trim();
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
