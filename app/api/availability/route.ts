import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/lib/repository';
import RoadmapAgent from '@/lib/agents/RoadmapAgent';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }

    const availability = repository.getWeeklyAvailability(userId);

    return NextResponse.json({ availability }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, startDate, totalHours, availableSlots } = body;

    if (!userId || !startDate || totalHours === undefined || !availableSlots) {
      return NextResponse.json({ errorMessage: 'All fields are required: userId, startDate, totalHours, availableSlots' }, { status: 400 });
    }

    const availability = repository.saveWeeklyAvailability(userId, {
      userId,
      startDate,
      totalHours,
      availableSlots
    });

    const goalId = '123';
    await RoadmapAgent.createRoadmap(userId, goalId, {
      metadata: { invokedBy: 'POST /api/availability' }
    });

    return NextResponse.json({ success: true, availability }, { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
