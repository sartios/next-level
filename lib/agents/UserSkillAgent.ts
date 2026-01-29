import assert from 'assert';
import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler, OpikHandlerOptions } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { saveSuggestedSkillsTool } from '@/lib/tools/saveSuggestedSkillsTool';
import { getAgentPrompt } from '@/lib/prompts';
import { SuggestedSkill } from '@/lib/mockDb';
import { SuggestedSkillSchema } from '@/lib/schemas';

interface SkillSuggestionResponse {
  userId: string;
  skills: SuggestedSkill[];
}

const SkillSuggestionResponseSchema = z.object({
  userId: z.string(),
  resources: z.array(SuggestedSkillSchema)
});

class UserSkillAgent {
  private readonly agentName = 'user-skill-agent';
  private readonly model = 'gpt-4.1-mini';

  private agent: ReturnType<typeof createAgent> | null = null;
  private initPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.agent) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const systemPrompt = await getAgentPrompt(this.agentName);
        this.agent = createAgent({
          model: new ChatOpenAI({ model: this.model }),
          tools: [fetchUserTool, saveSuggestedSkillsTool],
          systemPrompt: new SystemMessage(systemPrompt),
          responseFormat: providerStrategy(SkillSuggestionResponseSchema)
        });
      })();
    }

    await this.initPromise;
  }

  public async suggestSkills(userId: string, opikOptions?: OpikHandlerOptions): Promise<SkillSuggestionResponse> {
    await this.initialize();
    assert(this.agent, `${this.agentName} not ready`);

    const handler = createOpikHandler({
      tags: [this.agentName, 'operation:suggest', ...(opikOptions?.tags || [])],
      metadata: {
        agentName: this.agentName,
        userId,
        ...opikOptions?.metadata
      },
      threadId: opikOptions?.threadId
    });

    const result = await this.agent.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId }))] },
      { callbacks: [handler], runName: this.agentName }
    );

    return {
      userId,
      skills: result.structuredResponse.skills
    };
  }
}

const userSkillAgentInstance = new UserSkillAgent();
export default userSkillAgentInstance;
