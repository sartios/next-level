import { NextResponse } from 'next/server';
import { getSuggestedSkills } from '@/lib/repository';

export async function GET() {
  try {
    const userId = '123';
    const skills = getSuggestedSkills(userId);

    return NextResponse.json({ skills });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
