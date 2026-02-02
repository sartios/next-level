import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db/userRepository';
import { insertGoal } from '@/lib/db/goalRepository';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const body = await req.json();
    const { name, reasoning } = body;

    if (!name || !reasoning) {
      return NextResponse.json({ errorMessage: 'name and reasoning are required' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ errorMessage: 'User not found' }, { status: 404 });
    }

    const goal = await insertGoal({ userId: user.id, name, reasoning });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
