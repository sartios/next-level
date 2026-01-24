import { NextRequest, NextResponse } from 'next/server';
import roadmapAgent from '@/lib/agents/RoadmapAgent';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: goalId } = await params;
    const { selectedResources } = await req.json();

    const userId = '123';
    const result = await roadmapAgent.createRoadmap(userId, goalId, selectedResources, {
      tags: ['roadmap-creation'],
      metadata: { invokedBy: 'api/post-goal-roadmap' }
    });

    return NextResponse.json({ roadmap: result.roadmap, extraResources: result.extraResources });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
