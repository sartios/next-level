import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { OpikHandlerOptions, createAgentTrace, getOpikClient } from '@/lib/opik';
import { NextLevelOpikCallbackHandler } from '@/lib/trace/handler';
import { getUserById, User } from '@/lib/db/userRepository';
import { createStreamingLLM } from '@/lib/utils/llm';
import { getAgentPrompt } from '@/lib/prompts';
import { SKILLS_PER_USER } from '../prompts/agentPrompts';

async function buildUserPrompt(user: User): Promise<string> {
  return getAgentPrompt('user-skill-agent:user-prompt', {
    skillsPerUser: SKILLS_PER_USER,
    userRole: user.role,
    userSkills: user.skills.join(', '),
    userCareerGoals: user.careerGoals.join(', ')
  });
}

async function buildSystemPrompt(user: User): Promise<string> {
  return getAgentPrompt('user-skill-agent:system-prompt', {
    skillsPerUser: SKILLS_PER_USER,
    userRole: user.role,
    userSkills: user.skills.join(', '),
    userCareerGoals: user.careerGoals.join(', ')
  });
}

const SkillSchema = z.object({
  name: z.string(),
  priority: z.number(),
  reasoning: z.string()
});

interface SuggestedSkill {
  id: string;
  userId: string;
  name: string;
  priority: number;
  reasoning: string;
}

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

    const trace = createAgentTrace(this.agentName, 'stream', {
      input: { role: user.role, skills: user.skills, careerGoals: user.careerGoals },
      metadata: { userId, ...opikOptions?.metadata },
      tags: opikOptions?.tags,
      threadId: opikOptions?.threadId
    });

    try {
      yield { type: 'token', userId, content: 'Analyzing your profile...' };

      const llm = createStreamingLLM('gpt-5-mini');
      const [systemPrompt, userPrompt] = await Promise.all([buildSystemPrompt(user), buildUserPrompt(user)]);

      yield { type: 'token', userId, content: 'Generating skill suggestions...' };

      const traceHandler = new NextLevelOpikCallbackHandler({ parent: trace });
      const stream = await llm.stream([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
        callbacks: [traceHandler],
        runName: `${this.agentName}:stream`
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
      trace?.update({
        errorInfo: {
          exceptionType: err instanceof Error ? err.constructor.name : 'Error',
          message,
          traceback: err instanceof Error ? err.stack || '' : ''
        }
      });
      yield { type: 'token', userId, content: `__stream_error__: ${message}` };
      throw err;
    } finally {
      trace?.update({endTime: new Date()});
      await getOpikClient()?.flush();
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
