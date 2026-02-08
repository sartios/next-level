import { streamResources } from '@/lib/agents/SkillResourceRetrieverAgent';
import { getUserById } from '@/lib/db/userRepository';
import { getGoalById } from '@/lib/db/goalRepository';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; goalId: string }> }) {
  const { id: userId, goalId } = await params;

  const user = await getUserById(userId);
  if (!user) {
    return new Response(JSON.stringify({ errorMessage: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const goal = await getGoalById(goalId);
  if (!goal) {
    return new Response(JSON.stringify({ errorMessage: 'Goal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (goal.userId !== userId) {
    return new Response(JSON.stringify({ errorMessage: 'Goal does not belong to user' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const eventGenerator = streamResources(user, goal, {
          metadata: { invokedBy: `GET /api/users/${userId}/goals/${goalId}/resources/stream` }
        });

        for await (const event of eventGenerator) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorEvent = `data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}
