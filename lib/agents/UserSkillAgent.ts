import { SystemMessage, HumanMessage } from '@langchain/core/messages';

import { OpikHandlerOptions } from '@/lib/opik';
import { getAgentPrompt } from '@/lib/prompts';
import { SuggestedSkill, User } from '@/lib/mockDb';
import { SuggestedSkillSchema } from '@/lib/schemas';
import { getUserById } from '@/lib/repository';
import { createStreamingLLM } from '@/lib/utils/llm';
import { createAgentOpikHandler } from '@/lib/utils/createAgentOpikHandler';
import { parseJsonLinesStream } from '@/lib/utils/streamJsonLines';

interface SkillSuggestionResponse {
  skills: SuggestedSkill[];
}

class UserSkillAgent {
  private readonly agentName = 'user-skill-agent';

  public async suggestSkills(userId: string, opikOptions?: OpikHandlerOptions): Promise<SkillSuggestionResponse> {
    const user = getUserById(userId);

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

    const llm = createStreamingLLM('gpt-5-mini');
    const handler = createAgentOpikHandler(this.agentName, 'suggest-stream', { userId }, opikOptions);

    const systemPrompt = await getAgentPrompt('user-skill-agent:system-prompt');
    const userPrompt = await getAgentPrompt('user-skill-agent:user-prompt', { user: JSON.stringify(user) });

    yield { type: 'token', userId };

    const stream = await llm.stream([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)], {
      callbacks: [handler],
      runName: this.agentName
    });

    const emittedSkills: SuggestedSkill[] = [];
    let skillIndex = 0;

    for await (const data of parseJsonLinesStream(stream, SuggestedSkillSchema)) {
      const skill: SuggestedSkill = {
        id: `skill-${userId}-${skillIndex++}`,
        userId,
        name: data.name,
        priority: data.priority,
        reasoning: data.reasoning
      };
      emittedSkills.push(skill);
      yield { type: 'skill', userId, skill };
    }

    yield {
      type: 'complete',
      userId,
      result: { skills: emittedSkills }
    };
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
