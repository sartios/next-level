import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { OpikHandlerOptions } from '@/lib/opik';
import { SuggestedSkill, User } from '@/lib/mockDb';
import { getUserById } from '@/lib/db/userRepository';
import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';

const SYSTEM_PROMPT = `You are a career development assistant.
Your goal is to suggest a list of 10 skills that will help them achieve their career goals.
**Do NOT include skills the user already has** (from the user's skills list).
For each suggested skill, provide a short reasoning explaining why it is important and how it helps the individual.
Prioritize skills from most important to least important (priority: 1 is highest, 10 is lowest).

IMPORTANT: You MUST output ONLY valid JSON Lines format - one JSON object per line, with NO markdown code blocks, NO extra text, and NO explanations.
Each line must be a valid JSON object with exactly these fields: "name", "priority", "reasoning".`;

function buildUserPrompt(user: User): string {
  return `User Profile:
- Role: ${user.role}
- Current Skills: ${user.skills.join(', ')}
- Career Goals: ${user.careerGoals.join(', ')}

Based on this profile, suggest 10 skills that will help this professional achieve their career goals. Remember to exclude skills they already have.`;
}

const SkillSchema = z.object({
  name: z.string(),
  priority: z.number(),
  reasoning: z.string()
});

type ParsedSkill = z.infer<typeof SkillSchema>;

function tryParseJsonLine(line: string): ParsedSkill | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const validated = SkillSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // Invalid JSON, skip
  }

  return null;
}

interface SkillSuggestionResponse {
  skills: SuggestedSkill[];
}

class UserSkillAgent {
  private readonly agentName = 'user-skill-agent';

  public async suggestSkills(userId: string, opikOptions?: OpikHandlerOptions): Promise<SkillSuggestionResponse> {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    for await (const event of this.streamSkillSuggestions(user, opikOptions)) {
      if (event.type === 'complete' && event.result) {
        return event.result;
      }
    }

    return { skills: [] };
  }

  public async *streamSkillSuggestions(user: User, opikOptions?: OpikHandlerOptions): AsyncGenerator<UserSkillStreamEvent> {
    if (!user) {
      throw new Error('User is required');
    }
    const userId = user.id;

    const emittedSkills: SuggestedSkill[] = [];

    // Create Opik handler for tracing
    const handler = createAgentOpikHandler(this.agentName, 'stream', { userId }, opikOptions);

    try {
      yield { type: 'token', userId, content: 'Analyzing your profile...' };

      const llm = createStreamingLLM('gpt-5-mini');
      const userPrompt = buildUserPrompt(user);

      yield { type: 'token', userId, content: 'Generating skill suggestions...' };

      const stream = await llm.stream([new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userPrompt)], {
        callbacks: [handler]
      });

      let skillIndex = 0;
      let buffer = '';

      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content !== 'string') continue;

        buffer += content;

        // Try to extract complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const parsed = tryParseJsonLine(line);
          if (parsed !== null) {
            const skill: SuggestedSkill = {
              id: `skill-${userId}-${skillIndex++}`,
              userId,
              name: parsed.name,
              priority: parsed.priority,
              reasoning: parsed.reasoning
            };
            emittedSkills.push(skill);
            yield { type: 'skill', userId, skill };
          }
        }
      }

      // Process any remaining content in buffer
      const lastParsed = tryParseJsonLine(buffer);
      if (lastParsed !== null) {
        const skill: SuggestedSkill = {
          id: `skill-${userId}-${skillIndex++}`,
          userId,
          name: lastParsed.name,
          priority: lastParsed.priority,
          reasoning: lastParsed.reasoning
        };
        emittedSkills.push(skill);
        yield { type: 'skill', userId, skill };
      }

      yield {
        type: 'complete',
        userId,
        result: { skills: emittedSkills }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: 'token', userId, content: `__stream_error__: ${message}` };
      throw err;
    }
  }
}

export interface UserSkillStreamEvent {
  type: 'token' | 'skill' | 'complete';
  content?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  userId: string;
  skill?: SuggestedSkill;
  result?: SkillSuggestionResponse;
}

const userSkillAgentInstance = new UserSkillAgent();
export default userSkillAgentInstance;
