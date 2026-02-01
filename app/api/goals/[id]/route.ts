import { NextResponse } from 'next/server';
import * as repository from '@/lib/repository';

export async function GET() {
  try {
    const goal = await repository.getCurrentUserGoal('123');

    return NextResponse.json({ goal });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
