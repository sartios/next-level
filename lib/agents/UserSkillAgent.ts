import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';

export interface SuggestedSkill {
  name: string;
  priority: number;
  reasoning: string;
}

interface SkillSuggestionResult {
  userId: string;
  skills: SuggestedSkill[];
}

const SuggestedSkillSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      priority: z.number(),
      reasoning: z.string()
    })
  )
});

class UserSkillAgent {
  private agent;

  constructor() {
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool],
      systemPrompt: new SystemMessage(
        `
You are a career development assistant.

Given a user profile fetched via the fetchUser tool, suggest a list of 10 skills that will help them achieve their career goals.

**Do NOT include skills the user already has** (from the "skills" array in their profile).

For each suggested skill, provide a short reasoning explaining why it is important and how it helps the individual.

Prioritize skills from most important to least important.
    `.trim()
      ),
      responseFormat: providerStrategy(SuggestedSkillSchema)
    });
  }

  public async suggestSkills(
    userId: string,
    opikOptions?: { tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<SkillSuggestionResult> {
    const handler = createOpikHandler(opikOptions);

    const result = await this.agent.invoke({ messages: [new HumanMessage(JSON.stringify({ userId }))] }, { callbacks: [handler] });

    return {
      userId,
      skills: result.structuredResponse.skills
    };
  }
}

const userSkillAgentInstance = new UserSkillAgent();
export default userSkillAgentInstance;
