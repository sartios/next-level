// import  { runUserAgent } from '@/lib/agents/SkillPrioritizationAgent';
import UserSkillAgent from '@/lib/agents/UserSkillAgent';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const userId = '123';
    const result = await UserSkillAgent.suggestSkills(userId, {
      tags: ['skill-suggestion'],
      metadata: { invokedBy: 'api/get-goal-skills' }
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
