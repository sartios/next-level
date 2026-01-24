import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { suggestExtraResourcesTool } from '@/lib/tools/suggestExtraResourcesTool';

import { SuggestedSkill } from './UserSkillAgent';

interface Resource {
  title: string;
  link: string;
  reasoning: string;
}

interface RoadmapStep {
  step: string;
  description: string;
  resources: Resource[];
}

interface RoadmapResult {
  goal: Omit<SuggestedSkill, 'priority'>;
  roadmap: RoadmapStep[];
  extraResources: Resource[];
}

const RoadmapSchema = z.object({
  goal: z.object({
    name: z.string(),
    reasoning: z.string()
  }),
  roadmap: z.array(
    z.object({
      step: z.string(),
      description: z.string(),
      resources: z.array(
        z.object({
          title: z.string(),
          link: z.string(),
          reasoning: z.string()
        })
      )
    })
  ),
  extraResources: z.array(
    z.object({
      title: z.string(),
      link: z.string(),
      reasoning: z.string()
    })
  )
});

class RoadmapAgent {
  private agent;

  constructor() {
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool, fetchUserGoalTool, suggestExtraResourcesTool],
      systemPrompt: new SystemMessage(
        `
You are a roadmap planner agent.

Your goal is to create a step-by-step roadmap for a user to master a specific skill. 
You have access to the following tools:

- fetchUser: fetch the user's full profile, including skills, role, and career goals.
- fetchUserGoal: fetch the user's selected skill/goal.

You may use the tools as you see fit. Use the resources provided to organize a roadmap of high level sequential learning steps.
        `.trim()
      ),
      responseFormat: providerStrategy(RoadmapSchema)
    });
  }

  public async createRoadmap(
    userId: string,
    goalId: string,
    selectedResources: Resource[],
    opikOptions?: { tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<RoadmapResult> {
    const handler = createOpikHandler(opikOptions);

    const result = await this.agent.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId, selectedResources }))] },
      { callbacks: [handler] }
    );

    return {
      goal: result.structuredResponse.goal,
      roadmap: result.structuredResponse.roadmap,
      extraResources: result.structuredResponse.extraResources
    };
  }
}

const roadmapAgentInstance = new RoadmapAgent();
export default roadmapAgentInstance;
