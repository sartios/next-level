import { NextRequest, NextResponse } from 'next/server';
import skillResourceAgentInstance from '@/lib/agents/SkillResourceAgent';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: goalId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }
    const result = await skillResourceAgentInstance.suggestResources(userId, goalId, {
      tags: ['resource-retrieval'],
      metadata: { invokedBy: 'api/get-goal-resources' }
    });

    return NextResponse.json({ resources: result.resources });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
