import { NextRequest, NextResponse } from 'next/server';
import skillResourceAgentInstance from '@/lib/agents/SkillResourceAgent';
import { getUserById, getUserGoalById } from '@/lib/repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: goalId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }

    const user = getUserById(userId);
    const goal = getUserGoalById(user.id, goalId);

    const result = await skillResourceAgentInstance.suggestResources(user, goal, {
      metadata: { invokedBy: 'GET /api/goals/{id}/resources' }
    });

    return NextResponse.json({ resources: result.resources });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
