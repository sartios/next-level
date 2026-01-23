import { run } from '@openai/agents';
import { logOpik } from '@/lib/opik';
import ApplicationPromptAgent from '@/lib/agents/ApplicationPromptAgent';

export async function POST() {
  const userPrompt = `
    I want to apply what I’m learning directly to my real work or daily life.

    Here is my context:
    - Skill I am currently learning:
    - My role or main responsibilities:
    - A recent or upcoming situation where I could apply this skill:
    - Level of difficulty I’m comfortable with right now:
    - Any constraints (time, authority, resources):

    Based on this information, give me one clear, actionable prompt that I can act on immediately to apply this skill in a real situation.
`;
  const result = await run(ApplicationPromptAgent, userPrompt);

  logOpik('application-prompt.generated', result.finalOutput);
  return Response.json(result.finalOutput);
}
