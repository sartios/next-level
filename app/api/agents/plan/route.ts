import { run } from '@openai/agents';
import { logOpik } from '@/lib/opik';
import AdaptivePlanningAgent from '@/lib/agents/AdaptivePlanningAgent';

export async function POST() {
  const userPrompt = `
I want to create a learning plan that fits my real life and helps me stay consistent.

Here is my context:
- Skill I am focusing on:
- My current level with this skill:
- Time I can realistically dedicate each week:
- Preferred learning format (e.g. reading, videos, practice, reflection):
- Typical days or times I can learn:
- Any recent missed sessions or interruptions:
- Other commitments or constraints:

Based on this information, create a flexible weekly learning plan that:
- Fits my schedule
- Adapts if I miss a session
- Prioritizes consistency over intensity
- Helps me make steady progress without burnout
`;
  const result = await run(AdaptivePlanningAgent, userPrompt);

  logOpik('plan.created', result.finalOutput);
  return Response.json(result.finalOutput);
}
