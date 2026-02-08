import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/lib/db/userRepository';
import type { Goal } from '@/lib/db/goalRepository';
import type { GoalResourceStreamEvent } from '@/lib/agents/SkillResourceRetrieverAgent';
import { collectEvents, makeUser, makeGoal, makeResource } from '../helpers/agentTestHarness';

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

const mockInvoke = vi.fn();

vi.mock('@/lib/utils/llm', () => ({
  createLLM: vi.fn(() => ({ invoke: mockInvoke }))
}));

const mockSearch = vi.fn();

vi.mock('@/lib/tools/searchCuratedResourcesTool', () => ({
  searchCuratedResources: (...args: unknown[]) => mockSearch(...args)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper to make the LLM return a valid queries response */
function mockQueriesResponse(queries: string[]) {
  mockInvoke.mockResolvedValueOnce({
    content: JSON.stringify({ queries })
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streamResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    mockSearch.mockReset();
  });

  async function importAgent() {
    const { streamResources } = await import('@/lib/agents/SkillResourceRetrieverAgent');
    return streamResources;
  }

  it('throws when user is null', async () => {
    const streamResources = await importAgent();
    const gen = streamResources(null as unknown as User, makeGoal());
    await expect(gen.next()).rejects.toThrow('User is required');
  });

  it('throws when goal is null', async () => {
    const streamResources = await importAgent();
    const gen = streamResources(makeUser(), null as unknown as Goal);
    await expect(gen.next()).rejects.toThrow('Goal is required');
  });

  it('emits initial token and search tokens', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['graphql basics']);
    mockSearch.mockResolvedValueOnce([]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));

    expect(events[0]).toEqual(expect.objectContaining({ type: 'token', content: 'Generating search queries...' }));
    const searchToken = events.find((e) => e.type === 'token' && e.content?.startsWith('Searching:'));
    expect(searchToken).toBeDefined();
    expect(searchToken!.content).toContain('graphql basics');
  });

  it('streams resources from search results', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['query1', 'query2']);
    mockSearch.mockResolvedValueOnce([makeResource('r1', 'GraphQL Intro')]);
    mockSearch.mockResolvedValueOnce([makeResource('r2', 'Advanced GraphQL')]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));
    const resourceEvents = events.filter((e) => e.type === 'resource');

    expect(resourceEvents).toHaveLength(2);
    expect(resourceEvents[0].resource!.title).toBe('GraphQL Intro');
    expect(resourceEvents[1].resource!.title).toBe('Advanced GraphQL');
  });

  it('deduplicates resources across queries', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['q1', 'q2']);
    const sharedResource = makeResource('r-dup', 'Shared Resource');
    mockSearch.mockResolvedValueOnce([sharedResource]);
    mockSearch.mockResolvedValueOnce([sharedResource]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));
    const resourceEvents = events.filter((e) => e.type === 'resource');

    expect(resourceEvents).toHaveLength(1);
  });

  it('stops after reaching the resource cap', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['q1', 'q2', 'q3']);
    // The source checks >= 5 AFTER processing all resources from a query,
    // so q1 (3) + q2 (3) = 6 emitted, then the break skips q3 entirely.
    mockSearch.mockResolvedValueOnce([makeResource('r1', 'R1'), makeResource('r2', 'R2'), makeResource('r3', 'R3')]);
    mockSearch.mockResolvedValueOnce([makeResource('r4', 'R4'), makeResource('r5', 'R5'), makeResource('r6', 'R6')]);
    mockSearch.mockResolvedValueOnce([makeResource('r7', 'R7'), makeResource('r8', 'R8'), makeResource('r9', 'R9')]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));
    const resourceEvents = events.filter((e) => e.type === 'resource');

    // 6 resources emitted (q1=3 + q2=3), q3 skipped due to >= 5 check
    expect(resourceEvents).toHaveLength(6);
    expect(mockSearch).toHaveBeenCalledTimes(2);
  });

  it('emits complete event with all resources', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['q1']);
    mockSearch.mockResolvedValueOnce([makeResource('r1', 'Resource 1'), makeResource('r2', 'Resource 2')]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));
    const complete = events.find((e) => e.type === 'complete');

    expect(complete).toBeDefined();
    expect(complete!.result!.resources).toHaveLength(2);
  });

  it('throws on invalid query generation response', async () => {
    const streamResources = await importAgent();
    mockInvoke.mockResolvedValueOnce({ content: 'not valid json' });

    const gen = streamResources(makeUser(), makeGoal());
    const events: GoalResourceStreamEvent[] = [];

    await expect(async () => {
      for await (const event of gen) events.push(event);
    }).rejects.toThrow();

    const errorToken = events.find((e) => e.type === 'token' && e.content?.includes('__stream_error__'));
    expect(errorToken).toBeDefined();
  });

  it('continues when a search call fails', async () => {
    const streamResources = await importAgent();
    mockQueriesResponse(['q1', 'q2']);
    mockSearch.mockRejectedValueOnce(new Error('search failed'));
    mockSearch.mockResolvedValueOnce([makeResource('r1', 'Fallback Resource')]);

    const events = await collectEvents<GoalResourceStreamEvent>(streamResources(makeUser(), makeGoal()));
    const resourceEvents = events.filter((e) => e.type === 'resource');

    expect(resourceEvents).toHaveLength(1);
    expect(resourceEvents[0].resource!.title).toBe('Fallback Resource');
  });

  it('emits error token and rethrows on LLM failure', async () => {
    const streamResources = await importAgent();
    mockInvoke.mockRejectedValueOnce(new Error('LLM down'));

    const events: GoalResourceStreamEvent[] = [];
    const gen = streamResources(makeUser(), makeGoal());

    await expect(async () => {
      for await (const event of gen) events.push(event);
    }).rejects.toThrow('LLM down');

    const errorToken = events.find((e) => e.type === 'token' && e.content?.includes('__stream_error__'));
    expect(errorToken).toBeDefined();
    expect(errorToken!.content).toContain('LLM down');
  });
});
