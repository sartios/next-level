import { createAgent, providerStrategy } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

import { createOpikHandler } from '@/lib/opik';
import { Goal, RoadmapStep } from '@/lib/mockDb';
import { GoalSchema, ResourceSchema, RoadmapStepSchema } from '@/lib/schemas';
import { fetchUserTool } from '@/lib/tools/fetchUserTool';
import { fetchUserGoalTool } from '@/lib/tools/fetchUserGoalTool';
import { fetchUserAvailabilityTool } from '@/lib/tools/fetchUserAvailabilityTool';
import { saveGoalRoadmapTool } from '@/lib/tools/saveGoalRoadmapTool';

interface RoadmapResult {
  goal: Goal;
  roadmap: RoadmapStep[];
}

const RoadmapSchema = z.object({
  goal: GoalSchema.extend({
    resources: z.array(ResourceSchema).describe('Learning resources for the goal')
  }).omit({ roadmap: true, plan: true }),
  roadmap: z.array(RoadmapStepSchema)
});

class RoadmapAgent {
  private agent;

  constructor() {
    this.agent = createAgent({
      model: new ChatOpenAI({ model: 'gpt-4.1-mini' }),
      tools: [fetchUserTool, fetchUserGoalTool, fetchUserAvailabilityTool, saveGoalRoadmapTool],
      systemPrompt: new SystemMessage(
        `
You are a roadmap planner agent.

Your goal is to:
1. Fetch the user profile using fetchUser
2. Fetch the user's goal using fetchUserGoal
3. Fetch the user's weekly availability using fetchUserAvailability
4. Create a step-by-step roadmap for the user to master the skill based on their available time
5. IMPORTANT: Save the roadmap to the database using saveGoalRoadmap

You have access to the following tools:
- fetchUser: fetch the user's full profile, including skills, role, and career goals
- fetchUserGoal: fetch the user's selected skill/goal with its resources
- fetchUserAvailability: fetch the user's weekly availability including available time slots and total hours per week
- saveGoalRoadmap: save the generated roadmap to the goal (MUST be called after creating the roadmap)

Use the resources provided in the goal to organize a roadmap of high level sequential learning steps.
Each step should have a clear name, description, and associated resources from the goal.

For each roadmap step:
- Set "status" to "pending" (all steps start as pending)
- Assign a "timeline" array with scheduled sessions. Each timeline entry must include:
  - "date": a specific date in YYYY-MM-DD format (start from the user's availability startDate and schedule across multiple weeks as needed)
  - "startTime": the start time (e.g., "08:30")
  - "endTime": the end time (e.g., "09:00")
  - "durationMinutes": the duration in minutes
- Use the user's weekly availability slots to determine valid times for each day
- Distribute the learning activities across the scheduled dates based on the resources' approximate hours and the slot durations
        `.trim()
      ),
      responseFormat: providerStrategy(RoadmapSchema)
    });
  }

  public async createRoadmap(
    userId: string,
    goalId: string,
    opikOptions?: { tags?: string[]; metadata?: Record<string, unknown> }
  ): Promise<RoadmapResult> {
    const handler = createOpikHandler(opikOptions);

    const result = await this.agent.invoke(
      { messages: [new HumanMessage(JSON.stringify({ userId, goalId }))] },
      { callbacks: [handler], runName: 'RoadmapAgent' }
    );

    return {
      goal: result.structuredResponse.goal,
      roadmap: result.structuredResponse.roadmap
    };
  }
}

const roadmapAgentInstance = new RoadmapAgent();
export default roadmapAgentInstance;
