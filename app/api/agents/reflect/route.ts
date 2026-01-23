import { run } from '@openai/agents';
import { logOpik } from '@/lib/opik';
import ReflectionAgent from '@/lib/agents/ReflectionAgent';

export async function POST() {
  const userPrompt = `
    I want to reflect on my recent learning and experiences to better understand my progress.

    Here is my reflection:
    - What I worked on or practiced:
    - What felt challenging or uncomfortable:
    - What went better than expected:
    - How I felt before, during, or after:
    - Any outcomes or feedback I noticed:

    Based on this reflection, give me one concise insight that helps me learn, grow, or adjust how I approach this skill going forward.
`;
  const result = await run(ReflectionAgent, userPrompt);

  logOpik('insight.generated', result.finalOutput);
  return Response.json(result.finalOutput);
}
