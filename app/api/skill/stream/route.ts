import UserSkillAgent from '@/lib/agents/UserSkillAgent';
import { getUserById } from '@/lib/db/userRepository';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ errorMessage: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const user = await getUserById(userId);
  if (!user) {
    return new Response(JSON.stringify({ errorMessage: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const eventGenerator = UserSkillAgent.streamSkillSuggestions(user, {
          metadata: { invokedBy: 'GET /api/skill/stream' }
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
