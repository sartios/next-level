import { NextRequest, NextResponse } from 'next/server';
import { insertUser } from '@/lib/db/userRepository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, skills, careerGoals } = body;

    if (!role || !skills || !careerGoals) {
      return NextResponse.json({ errorMessage: 'All fields are required: role, skills, careerGoals' }, { status: 400 });
    }

    // Parse skills and careerGoals if they're strings
    const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim());
    const careerGoalsArray = Array.isArray(careerGoals) ? careerGoals : careerGoals.split(',').map((g: string) => g.trim());

    const user = await insertUser({
      role,
      skills: skillsArray,
      careerGoals: careerGoalsArray
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
