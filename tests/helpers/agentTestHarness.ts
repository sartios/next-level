import { vi } from 'vitest';
import type { User } from '@/lib/db/userRepository';
import type { Goal } from '@/lib/db/goalRepository';
import type { Challenge } from '@/lib/db/challengeRepository';
import type { LearningResourceWithSections } from '@/lib/types';

// ---------------------------------------------------------------------------
// Mock implementations — shared across agent test files.
// Used via async vi.mock() factories so hoisting isn't an issue.
// ---------------------------------------------------------------------------

export function mockSpan(): Record<string, ReturnType<typeof vi.fn>> {
  const s: Record<string, ReturnType<typeof vi.fn>> = {
    update: vi.fn(),
    score: vi.fn(),
    span: vi.fn(() => mockSpan())
  };
  return s;
}

export function mockAgentTrace() {
  return {
    update: vi.fn(),
    span: vi.fn(() => mockSpan())
  };
}

export function mockOpikClient() {
  return { flush: vi.fn() };
}

export async function mockPrompt() {
  return 'mock prompt';
}

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------

/**
 * Drains an async generator into an array.
 * Use with agent stream functions to collect all emitted events for assertions.
 */
export async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

/**
 * Creates a test User with sensible defaults.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    role: 'Frontend Developer',
    skills: ['React', 'TypeScript'],
    careerGoals: ['Senior Engineer'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Creates a test Goal with sensible defaults.
 */
export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Learn GraphQL',
    reasoning: 'Need for API work',
    selectedResourceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Creates a test Challenge with sensible defaults.
 */
export function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'challenge-1',
    goalId: 'goal-1',
    sectionId: 'section-1',
    sectionTitle: 'Introduction to GraphQL',
    sectionTopics: ['queries', 'mutations'],
    difficulty: 'easy',
    status: 'pending',
    totalQuestions: 10,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Creates a minimal LearningResourceWithSections for testing.
 */
export function makeResource(id: string, title: string): LearningResourceWithSections {
  return {
    id,
    url: `https://example.com/${id}`,
    title,
    description: null,
    provider: 'TestProvider',
    resourceType: 'course',
    learningObjectives: [],
    targetAudience: [],
    totalHours: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: []
  } as unknown as LearningResourceWithSections;
}

/**
 * Creates an async iterable that yields AIMessageChunk-like objects.
 * Use to mock LLM `.stream()` return values.
 */
export function makeChunks(contents: string[]) {
  return (async function* () {
    for (const content of contents) {
      yield { content };
    }
  })();
}
