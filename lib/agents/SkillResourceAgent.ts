import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { updateGoalResourcesTool } from '@/lib/tools/updateGoalResourcesTool';
import { SuggestedSkill } from '@/lib/agents/UserSkillAgent';
import { Resource } from '@/lib/mockDb';
import { ResourceSchema } from '@/lib/schemas';

interface ResourceSuggestionResult {
  goal: Omit<SuggestedSkill, 'priority'>;
  resources: Resource[];
}

const ResponseSchema = z.object({
  goal: z.object({
    name: z.string(),
    reasoning: z.string()
  }),
  resources: z.array(ResourceSchema)
});

class SkillResourceAgent {
  private agent;

  constructor() {
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool, fetchUserGoalTool, updateGoalResourcesTool],
      systemPrompt: new SystemMessage(
        `
You are a career development assistant.

Your goal is to:
1. Fetch the user profile using the fetchUser tool
2. Fetch the user's goal using the fetchUserGoal tool
3. Suggest learning resources based on the user's profile and goal.
4. The resources should not overlap in the content so the user does not repeat the same concepts, but a minium overlap of 15%-20% is acceptable.
5. IMPORTANT: Save the resources to the database using the updateGoalResources tool

Based on the user's profile and selected goal, suggest learning resources (articles, courses, videos, tutorials) relevant to the skill the user wants to grow in.

For each resource, provide:
- title of the resource
- link to the resource
- reasoning why this resource is important and how it helps the user achieve mastery of the skill.
- provider The provider of the resource
- approximateHours The approximate hours for completing the resource
- relevancePercentage The relevance percentage of the resource to the goal
- sections The subsections of the resource

For each resource section, provide:
- skill the skill to which the section is focused
- location the location of the section within the resource, for example chapter 1, video 5 etc

You have access to the following tools:
- fetchUser: fetch the user's full profile including skills, role, and career goals
- fetchUserGoal: fetch the specific skill or growth goal the user wants to focus on
- updateGoalResources: save the generated resources to the database (MUST be called after generating resources)

Respond ONLY in structured JSON matching this schema:

${ResponseSchema}
        `.trim()
      ),
      responseFormat: providerStrategy(ResponseSchema)
    });
  }

  public async suggestResources(
    userId: string,
    goalId: string,
    opikOptions?: { tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<ResourceSuggestionResult> {
    const handler = createOpikHandler(opikOptions);

    const result = await this.agent.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId }))] },
      { callbacks: [handler], runName: 'SkillResourceAgent' }
    );

    return {
      goal: result.structuredResponse.goal,
      resources: result.structuredResponse.resources
    };
  }
}

const skillResourceAgentInstance = new SkillResourceAgent();
export default skillResourceAgentInstance;
