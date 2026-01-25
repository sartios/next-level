import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/lib/repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: goalId } = await params;

    const goal = await repository.getUserGoalById('123', goalId);

    return NextResponse.json({ goal });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
