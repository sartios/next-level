import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAgentTrace, makeUser, makeGoal, makeResource, makeChallenge, makeChunks } from '../helpers/agentTestHarness';
import { silenceConsole } from '../helpers/loggerHarness';

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted so must live in the test file
// ---------------------------------------------------------------------------

vi.mock('@/lib/opik', async () => {
  const { mockAgentTrace, mockOpikClient } = await import('../helpers/agentTestHarness');
  return { createAgentTrace: vi.fn(mockAgentTrace), getOpikClient: vi.fn(mockOpikClient) };
});

vi.mock('@/lib/trace/handler', () => ({ NextLevelOpikCallbackHandler: vi.fn() }));

vi.mock('@/lib/prompts', async () => {
  const { mockPrompt } = await import('../helpers/agentTestHarness');
  return {
    getAgentPrompt: vi.fn(mockPrompt),
    QUESTIONS_PER_CHALLENGE: 10,
    DIFFICULTY_DESCRIPTIONS: {
      easy: 'beginner-friendly questions',
      medium: 'intermediate questions',
      hard: 'advanced questions'
    }
  };
});

const mockStream = vi.fn();

vi.mock('@/lib/utils/llm', () => ({
  createStreamingLLM: vi.fn(() => ({ stream: mockStream }))
}));

const mockUpdateStatus = vi.fn();
const mockAddQuestions = vi.fn();

vi.mock('@/lib/db/challengeRepository', () => ({
  updateChallengeStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  addChallengeQuestions: (...args: unknown[]) => mockAddQuestions(...args)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(n: number) {
  return {
    questionNumber: n,
    question: `Question ${n}?`,
    options: [
      { label: 'A', text: `Option A for Q${n}` },
      { label: 'B', text: `Option B for Q${n}` },
      { label: 'C', text: `Option C for Q${n}` },
      { label: 'D', text: `Option D for Q${n}` }
    ],
    correctAnswer: 'A',
    explanation: `Explanation for Q${n}`,
    hint: `Hint for Q${n}`
  };
}

function makeQuestions(count: number) {
  return Array.from({ length: count }, (_, i) => makeQuestion(i + 1));
}

function streamValidQuestions(count = 10) {
  mockStream.mockResolvedValueOnce(makeChunks([JSON.stringify(makeQuestions(count))]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChallengeGeneratorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.mockReset();
    mockUpdateStatus.mockReset();
    mockAddQuestions.mockReset();
  });

  async function importAgent() {
    const { generateChallengeQuestions, generateAllChallengesForGoal } = await import('@/lib/agents/ChallengeGeneratorAgent');
    return { generateChallengeQuestions, generateAllChallengesForGoal };
  }

  // ==========================================================================
  // generateChallengeQuestions
  // ==========================================================================

  describe('generateChallengeQuestions', () => {
    it('returns parsed questions on valid LLM response', async () => {
      const { generateChallengeQuestions } = await importAgent();
      streamValidQuestions();

      const result = await generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'GraphQL Course'), makeChallenge());

      expect(result).toHaveLength(10);
      expect(result[0]).toEqual(expect.objectContaining({ questionNumber: 1, question: 'Question 1?', correctAnswer: 'A' }));
    });

    it('throws when LLM stream fails', async () => {
      const { generateChallengeQuestions } = await importAgent();
      mockStream.mockRejectedValueOnce(new Error('LLM unavailable'));

      await expect(generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge())).rejects.toThrow(
        'LLM unavailable'
      );
    });

    it('throws on invalid JSON response', async () => {
      const { generateChallengeQuestions } = await importAgent();
      mockStream.mockResolvedValueOnce(makeChunks(['not json at all']));

      await expect(generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge())).rejects.toThrow(
        'JSON parse failed'
      );
    });

    it('throws on schema validation failure', async () => {
      const { generateChallengeQuestions } = await importAgent();
      const badQuestions = [{ questionNumber: 1, question: 'Q?', options: [], correctAnswer: 'Z', explanation: 'E' }];
      mockStream.mockResolvedValueOnce(makeChunks([JSON.stringify(badQuestions)]));

      await expect(generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge())).rejects.toThrow(
        'Schema validation failed'
      );
    });

    it('throws when question count does not match expected', async () => {
      const { generateChallengeQuestions } = await importAgent();
      streamValidQuestions(5); // only 5 instead of QUESTIONS_PER_CHALLENGE (10)

      await expect(generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge())).rejects.toThrow(
        'Expected 10 questions but got 5'
      );
    });

    it('handles JSON wrapped in markdown code fences', async () => {
      const { generateChallengeQuestions } = await importAgent();
      const json = JSON.stringify(makeQuestions(10));
      mockStream.mockResolvedValueOnce(makeChunks(['```json\n' + json + '\n```']));

      const result = await generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge());

      expect(result).toHaveLength(10);
    });

    it('creates own trace when no parentSpan provided', async () => {
      const { generateChallengeQuestions } = await importAgent();
      const { createAgentTrace } = await import('@/lib/opik');
      streamValidQuestions();

      await generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge());

      expect(createAgentTrace).toHaveBeenCalledWith(
        'challenge-generator-agent',
        'generate-section',
        expect.objectContaining({ input: expect.any(Object) })
      );
    });

    it('skips own trace when parentSpan is provided', async () => {
      const { generateChallengeQuestions } = await importAgent();
      const { createAgentTrace } = await import('@/lib/opik');
      streamValidQuestions();

      const parentSpan = mockAgentTrace();
      await generateChallengeQuestions(makeUser(), makeGoal(), makeResource('r1', 'Course'), makeChallenge(), parentSpan as never);

      expect(createAgentTrace).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // generateAllChallengesForGoal
  // ==========================================================================

  describe('generateAllChallengesForGoal', () => {
    it('processes all challenges and returns success count', async () => {
      const { generateAllChallengesForGoal } = await importAgent();
      const challenges = [makeChallenge({ id: 'c1' }), makeChallenge({ id: 'c2' })];
      streamValidQuestions();
      streamValidQuestions();

      const result = await generateAllChallengesForGoal(makeUser(), makeGoal(), makeResource('r1', 'Course'), challenges);

      expect(result).toEqual({ success: 2, failed: 0 });
    });

    it('continues on individual challenge failure and reports mixed counts', async () => {
      const { generateAllChallengesForGoal } = await importAgent();
      const challenges = [makeChallenge({ id: 'c1' }), makeChallenge({ id: 'c2' })];
      mockStream.mockRejectedValueOnce(new Error('LLM error'));
      streamValidQuestions();
      silenceConsole('error');

      const result = await generateAllChallengesForGoal(makeUser(), makeGoal(), makeResource('r1', 'Course'), challenges);

      expect(result).toEqual({ success: 1, failed: 1 });
    });

    it('calls updateChallengeStatus with correct lifecycle', async () => {
      const { generateAllChallengesForGoal } = await importAgent();
      const challenges = [makeChallenge({ id: 'c1' })];
      streamValidQuestions();

      await generateAllChallengesForGoal(makeUser(), makeGoal(), makeResource('r1', 'Course'), challenges);

      expect(mockUpdateStatus).toHaveBeenCalledWith('c1', 'generating');
      expect(mockUpdateStatus).toHaveBeenCalledWith('c1', 'complete');
    });

    it('marks failed challenges with error message', async () => {
      const { generateAllChallengesForGoal } = await importAgent();
      const challenges = [makeChallenge({ id: 'c1' })];
      mockStream.mockRejectedValueOnce(new Error('generation failed'));
      silenceConsole('error');

      await generateAllChallengesForGoal(makeUser(), makeGoal(), makeResource('r1', 'Course'), challenges);

      expect(mockUpdateStatus).toHaveBeenCalledWith('c1', 'generating');
      expect(mockUpdateStatus).toHaveBeenCalledWith('c1', 'failed', 'generation failed');
    });

    it('saves transformed questions to database', async () => {
      const { generateAllChallengesForGoal } = await importAgent();
      const challenges = [makeChallenge({ id: 'c1' })];
      streamValidQuestions();

      await generateAllChallengesForGoal(makeUser(), makeGoal(), makeResource('r1', 'Course'), challenges);

      expect(mockAddQuestions).toHaveBeenCalledWith(
        'c1',
        expect.arrayContaining([expect.objectContaining({ questionNumber: 1, question: 'Question 1?', correctAnswer: 'A' })])
      );
      expect(mockAddQuestions.mock.calls[0][1]).toHaveLength(10);
    });
  });
});
