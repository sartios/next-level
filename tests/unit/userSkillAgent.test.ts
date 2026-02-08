import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/lib/db/userRepository';
import type { UserSkillStreamEvent } from '@/lib/agents/UserSkillAgent';
import { collectEvents, makeUser, makeChunks } from '../helpers/agentTestHarness';

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
  return { getAgentPrompt: vi.fn(mockPrompt) };
});

const mockStream = vi.fn();

vi.mock('@/lib/utils/llm', () => ({
  createStreamingLLM: vi.fn(() => ({ stream: mockStream }))
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streamSkillSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.mockReset();
  });

  async function importAgent() {
    const { streamSkillSuggestions } = await import('@/lib/agents/UserSkillAgent');
    return streamSkillSuggestions;
  }

  it('throws when user is null', async () => {
    const streamSkillSuggestions = await importAgent();
    const gen = streamSkillSuggestions(null as unknown as User);
    await expect(gen.next()).rejects.toThrow('User is required');
  });

  it('emits initial token events', async () => {
    const streamSkillSuggestions = await importAgent();
    mockStream.mockResolvedValueOnce(makeChunks([]));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));

    expect(events[0]).toEqual(expect.objectContaining({ type: 'token', content: 'Analyzing your profile...' }));
    expect(events[1]).toEqual(expect.objectContaining({ type: 'token', content: 'Generating skill suggestions...' }));
  });

  it('parses streamed JSON lines into skill events', async () => {
    const streamSkillSuggestions = await importAgent();
    const line1 = JSON.stringify({ name: 'GraphQL', priority: 1, reasoning: 'Needed for APIs' });
    const line2 = JSON.stringify({ name: 'Node.js', priority: 2, reasoning: 'Backend growth' });
    mockStream.mockResolvedValueOnce(makeChunks([line1 + '\n', line2 + '\n']));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));
    const skillEvents = events.filter((e) => e.type === 'skill');

    expect(skillEvents).toHaveLength(2);
    expect(skillEvents[0].skill).toEqual(expect.objectContaining({ name: 'GraphQL', priority: 1, reasoning: 'Needed for APIs' }));
    expect(skillEvents[1].skill).toEqual(expect.objectContaining({ name: 'Node.js', priority: 2, reasoning: 'Backend growth' }));
  });

  it('emits complete event with all skills', async () => {
    const streamSkillSuggestions = await importAgent();
    const line = JSON.stringify({ name: 'Docker', priority: 1, reasoning: 'Containerization' });
    mockStream.mockResolvedValueOnce(makeChunks([line + '\n']));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));
    const complete = events.find((e) => e.type === 'complete');

    expect(complete).toBeDefined();
    expect(complete!.result!.skills).toHaveLength(1);
    expect(complete!.result!.skills[0].name).toBe('Docker');
  });

  it('handles partial chunks across stream boundaries', async () => {
    const streamSkillSuggestions = await importAgent();
    const fullLine = JSON.stringify({ name: 'Rust', priority: 3, reasoning: 'Systems programming' });
    const half1 = fullLine.slice(0, 15);
    const half2 = fullLine.slice(15) + '\n';
    mockStream.mockResolvedValueOnce(makeChunks([half1, half2]));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));
    const skillEvents = events.filter((e) => e.type === 'skill');

    expect(skillEvents).toHaveLength(1);
    expect(skillEvents[0].skill!.name).toBe('Rust');
  });

  it('skips invalid JSON lines', async () => {
    const streamSkillSuggestions = await importAgent();
    const validLine = JSON.stringify({ name: 'Go', priority: 2, reasoning: 'Concurrency' });
    mockStream.mockResolvedValueOnce(makeChunks(['not valid json\n', validLine + '\n']));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));
    const skillEvents = events.filter((e) => e.type === 'skill');

    expect(skillEvents).toHaveLength(1);
    expect(skillEvents[0].skill!.name).toBe('Go');
  });

  it('handles empty LLM response', async () => {
    const streamSkillSuggestions = await importAgent();
    mockStream.mockResolvedValueOnce(makeChunks([]));

    const events = await collectEvents<UserSkillStreamEvent>(streamSkillSuggestions(makeUser()));
    const skillEvents = events.filter((e) => e.type === 'skill');
    const complete = events.find((e) => e.type === 'complete');

    expect(skillEvents).toHaveLength(0);
    expect(complete!.result!.skills).toHaveLength(0);
  });

  it('emits error token and rethrows on LLM failure', async () => {
    const streamSkillSuggestions = await importAgent();
    mockStream.mockRejectedValueOnce(new Error('LLM unavailable'));

    const events: UserSkillStreamEvent[] = [];
    const gen = streamSkillSuggestions(makeUser());

    await expect(async () => {
      for await (const event of gen) events.push(event);
    }).rejects.toThrow('LLM unavailable');

    const errorToken = events.find((e) => e.type === 'token' && e.content?.includes('__stream_error__'));
    expect(errorToken).toBeDefined();
    expect(errorToken!.content).toContain('LLM unavailable');
  });
});
