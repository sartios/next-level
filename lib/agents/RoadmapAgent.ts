import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { saveGoalRoadmapTool } from '@/lib/tools/saveGoalRoadmapTool';

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
      tools: [fetchUserTool, fetchUserGoalTool, saveGoalRoadmapTool],
      systemPrompt: new SystemMessage(
        `
You are a roadmap planner agent.

Your goal is to:
1. Fetch the user profile using fetchUser
2. Fetch the user's goal using fetchUserGoal
3. Create a step-by-step roadmap for the user to master the skill
4. IMPORTANT: Save the roadmap to the database using saveGoalRoadmap

You have access to the following tools:
- fetchUser: fetch the user's full profile, including skills, role, and career goals
- fetchUserGoal: fetch the user's selected skill/goal with its resources
- suggestExtraResources: suggest additional resources if needed
- saveGoalRoadmap: save the generated roadmap to the goal (MUST be called after creating the roadmap)

Use the resources provided in the goal to organize a roadmap of high level sequential learning steps.
Each step should have a clear name, description, and associated resources from the goal.
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
