import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDb, closeConnection } from '../../lib/db';
import { users } from '../../lib/db/schema';
import { insertUser, getUserById, updateUser } from '../../lib/db/userRepository';

describe('userRepository integration tests', () => {
  let testUserId: string;

  afterAll(async () => {
    const db = requireDb();
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await closeConnection();
  });

  it('inserts a user and returns it with id', async () => {
    const result = await insertUser({
      role: 'Backend Developer',
      skills: ['Node.js', 'PostgreSQL'],
      careerGoals: ['Staff Engineer']
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.role).toBe('Backend Developer');
    expect(result.skills).toEqual(['Node.js', 'PostgreSQL']);
    expect(result.careerGoals).toEqual(['Staff Engineer']);

    testUserId = result.id;
  });

  it('retrieves user by id', async () => {
    const result = await getUserById(testUserId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(testUserId);
    expect(result?.role).toBe('Backend Developer');
  });

  it('returns undefined for non-existent id', async () => {
    const result = await getUserById('00000000-0000-0000-0000-000000000000');

    expect(result).toBeUndefined();
  });

  it('updates user fields', async () => {
    const result = await updateUser(testUserId, {
      role: 'Fullstack Developer',
      skills: ['React', 'Node.js', 'PostgreSQL']
    });

    expect(result).toBeDefined();
    expect(result?.role).toBe('Fullstack Developer');
    expect(result?.skills).toEqual(['React', 'Node.js', 'PostgreSQL']);
  });

  it('partial update preserves other fields', async () => {
    const result = await updateUser(testUserId, { role: 'DevOps Engineer' });

    expect(result).toBeDefined();
    expect(result?.role).toBe('DevOps Engineer');
    expect(result?.skills).toEqual(['React', 'Node.js', 'PostgreSQL']);
    expect(result?.careerGoals).toEqual(['Staff Engineer']);
  });
});
