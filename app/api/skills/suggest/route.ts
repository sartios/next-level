import { NextRequest, NextResponse } from 'next/server';
import userSkillAgent from '@/lib/agents/UserSkillAgent';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }

    const result = await userSkillAgent.suggestSkills(userId, {
      metadata: { invokedBy: 'POST /api/skills/suggest' }
    });

    return NextResponse.json({ success: true, skills: result.skills });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
