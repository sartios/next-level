import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/lib/repository';
import multiWeekPlanningAgent from '@/lib/agents/MultiWeekPlanningAgent';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: goalId } = await params;
    const { roadmap, userId } = await req.json();

    if (!roadmap || !userId) {
      return NextResponse.json({ errorMessage: 'Roadmap and userId are required' }, { status: 400 });
    }

    const savedRoadmap = repository.saveRoadmap(userId, goalId, roadmap);
    const startDate = new Date().toISOString().split('T')[0];
    const multiWeekPlan = await multiWeekPlanningAgent.createMultiWeekPlan(userId, goalId, startDate, {
      metadata: { invokedBy: 'POST /api/goals/{id}/roadmap/accept' }
    });

    return NextResponse.json({ success: true, roadmap: savedRoadmap, multiWeekPlan });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.log(errorMessage);

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
