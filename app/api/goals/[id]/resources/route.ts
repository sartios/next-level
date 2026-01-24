import { NextRequest, NextResponse } from 'next/server';
import skillResourceAgentInstance from '@/lib/agents/SkillResourceAgent';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: goalId } = await params;

    const userId = '123';
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
