import { NextRequest, NextResponse } from 'next/server';
import { saveWeeklyAvailability } from '@/lib/repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, startDate, totalHours, availableSlots } = body;

    if (!userId || !startDate || totalHours === undefined || !availableSlots) {
      return NextResponse.json({ errorMessage: 'All fields are required: userId, startDate, totalHours, availableSlots' }, { status: 400 });
    }

    const availability = saveWeeklyAvailability({
      userId,
      startDate,
      totalHours,
      availableSlots
    });

    return NextResponse.json({ success: true, availability }, { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ errorMessage }, { status: 500 });
  }
}
