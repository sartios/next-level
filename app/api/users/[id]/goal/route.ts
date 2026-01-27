import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/lib/repository';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const goal = repository.getCurrentUserGoal(userId);

    return NextResponse.json({ goal });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
