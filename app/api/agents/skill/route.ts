import { run } from '@openai/agents';
import { logOpik } from '@/lib/opik';
import SkillPrioritizationAgent from '@/lib/agents/SkillPrioritizationAgent';

export async function POST() {
  const userPrompt = `
I want to advance my professional career this year, but I have limited time and energy.

Here is my context:
- Current role and responsibilities:
- Career goals for the next 1-2 years:
- Skills I already have:
- Skills I'm considering learning:
- Time I can realistically dedicate per week:
- Any challenges or constraints I face:

Based on this information, recommend the single most high-impact skill I should focus on right now.
`;
  const result = await run(SkillPrioritizationAgent, userPrompt);

  logOpik('skill.selected', result.finalOutput);
  return Response.json(result.finalOutput);
}
