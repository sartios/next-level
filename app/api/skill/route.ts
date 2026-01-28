// import  { runUserAgent } from '@/lib/agents/SkillPrioritizationAgent';
import UserSkillAgent from '@/lib/agents/UserSkillAgent';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ errorMessage: 'userId is required' }, { status: 400 });
    }
    const result = await UserSkillAgent.suggestSkills(userId, {
      metadata: { invokedBy: 'GET /api/skill' }
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
