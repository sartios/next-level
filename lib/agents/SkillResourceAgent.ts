import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { SuggestedSkill } from '@/lib/agents/UserSkillAgent';

interface Resource {
  title: string;
  link: string;
  reasoning: string;
}

interface ResourceSuggestionResult {
  goal: Omit<SuggestedSkill, 'priority'>;
  resources: Resource[];
}

const ResourceSchema = z.object({
  goal: z.object({
    name: z.string(),
    reasoning: z.string()
  }),
  resources: z.array(
    z.object({
      title: z.string(),
      link: z.string(),
      reasoning: z.string()
    })
  )
});

class SkillResourceAgent {
  private agent;

  constructor() {
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool, fetchUserGoalTool],
      systemPrompt: new SystemMessage(
        `
You are a career development assistant.

Use the following tools to gather context before suggesting resources:
- fetchUser: fetch the user's full profile including skills, role, and career goals.
- fetchUserGoal: fetch the specific skill or growth goal the user wants to focus on.

Based on the user's profile and selected goal, suggest learning resources (articles, courses, videos, tutorials) relevant to the skill the user wants to grow in.

For each resource, provide:
- title of the resource
- link to the resource
- reasoning why this resource is important and how it helps the user achieve mastery of the skill.

Respond ONLY in structured JSON matching this schema:

${ResourceSchema}
        `.trim()
      ),
      responseFormat: providerStrategy(ResourceSchema)
    });
  }

  public async suggestResources(
    userId: string,
    goalId: string,
    opikOptions?: { tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<ResourceSuggestionResult> {
    const handler = createOpikHandler(opikOptions);

    const result = await this.agent.invoke({ messages: [new HumanMessage(JSON.stringify({ userId, goalId }))] }, { callbacks: [handler] });

    return {
      goal: result.structuredResponse.goal,
      resources: result.structuredResponse.resources
    };
  }
}

const skillResourceAgentInstance = new SkillResourceAgent();
export default skillResourceAgentInstance;
