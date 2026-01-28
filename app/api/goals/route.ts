import { NextRequest, NextResponse } from 'next/server';
import { createGoal, updateGoalResources } from '@/lib/repository';
import SkillResourceAgent from '@/lib/agents/SkillResourceAgent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, reasoning } = body;

    if (!userId || !name || !reasoning) {
      return NextResponse.json({ errorMessage: 'userId, name, and reasoning are required' }, { status: 400 });
    }

    const goal = createGoal({ userId, name, reasoning });

    // Invoke SkillResourceAgent to fetch resources for the new goal
    const resourceResult = await SkillResourceAgent.suggestResources(userId, goal.id, {
      metadata: { invokedBy: 'POST /api/goals' }
    });

    // Save resources to the goal
    const updatedGoal = updateGoalResources(resourceResult.resources);

    return NextResponse.json({ goal: updatedGoal, resources: resourceResult.resources });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
