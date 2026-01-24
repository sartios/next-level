import { db } from './mockDb';

export const getUserById = (userId: string) => ({ ...db.user, id: userId });
export const getUserGoalById = (userId: string, goalId: string) => ({ ...db.goal, id: goalId, userId: userId });

export const updatePlan = (plan: unknown) => {
  db.plan = plan;

  return db.plan;
};

export const logReflection = (reflection: string) => {
  db.reflections.push(reflection);

  return db.reflections;
};
