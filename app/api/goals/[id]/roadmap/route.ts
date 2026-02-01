import { NextRequest, NextResponse } from 'next/server';
import roadmapAgent from '@/lib/agents/RoadmapAgent';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: goalId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }
    const result = await roadmapAgent.createRoadmap(userId, goalId, {
      metadata: { invokedBy: 'POST /api/goals/{id}/roadmap' }
    });

    return NextResponse.json({ roadmap: result.roadmap });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
