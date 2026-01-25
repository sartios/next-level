import { db, Plan, RoadmapStep, User, WeeklyAvailability } from './mockDb';

export const createUser = (userData: Omit<User, 'id'>) => {
  const userId = Date.now().toString();
  db.user = {
    id: userId,
    name: userData.name,
    role: userData.role,
    skills: userData.skills,
    careerGoals: userData.careerGoals
  };

  return db.user;
};

export const getUserById = (userId: string) => ({ ...db.user, id: userId });
export const getUserGoalById = (userId: string, goalId: string) => ({ ...db.goal, id: goalId, userId: userId });

interface CreateGoalDTO {
  userId: string;
  name: string;
  reasoning: string;
}
export const createGoal = (goalData: CreateGoalDTO) => {
  const goalId = Date.now().toString();
  db.goal = {
    id: goalId,
    userId: goalData.userId,
    name: goalData.name,
    reasoning: goalData.reasoning
  };

  return db.goal;
};

export const updateGoalResources = (resources: { title: string; link: string; reasoning: string }[]) => {
  db.goal.resources = resources;

  return db.goal;
};

export const getAcceptedRoadmapByGoalAndUser = (userId: string, goalId: string) => ({
  userId,
  goalId,
  roadmap: db.goal.roadmap
});

export const saveMultiWeekPlan = (userId: string, goalId: string, plan: Plan) => {
  db.goal.id = goalId;
  db.goal.userId = userId;
  db.goal.plan = plan;

  return db.goal;
};

export const saveRoadmap = (userId: string, goalId: string, roadmap: RoadmapStep[]) => {
  db.goal.id = goalId;
  db.goal.userId = userId;
  db.goal.roadmap = roadmap;

  return db.goal;
};

export const saveWeeklyAvailability = (userId: string, availability: WeeklyAvailability) => {
  db.weeklyAvailability.userId = userId;
  db.weeklyAvailability = availability;

  return db.weeklyAvailability;
};

export const getWeeklyAvailability = (userId: string) => ({ ...db.weeklyAvailability, userId });

interface CreateSuggestedSkillDTO {
  name: string;
  priority: number;
  reasoning: string;
}
export const saveSuggestedSkills = (userId: string, skills: CreateSuggestedSkillDTO[]) => {
  db.suggestedSkills = skills.map((s, index) => ({ ...s, id: `${index}`, userId }));

  return db.suggestedSkills;
};

export const getSuggestedSkills = (userId: string) => db.suggestedSkills.filter((s) => s.userId === userId);
