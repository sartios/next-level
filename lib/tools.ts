import { db } from './mockDb';

export const getUserContext = () => db;

export const updatePlan = (plan: unknown) => {
  db.plan = plan;

  return db.plan;
};

export const logReflection = (reflection: string) => {
  db.reflections.push(reflection);

  return db.reflections;
};
