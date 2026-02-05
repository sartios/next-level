/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Dataset Item Types - Input data for evaluations
// ============================================================================

export interface BaseDatasetItem {
  id: string;
  name: string;
}

export interface UserSkillDatasetItem extends BaseDatasetItem {
  input: {
    user: any;
  };
  expected: {
    skillCount: number;
    excludedSkills: string[];
    expectedCategories?: string[];
  };
}

export interface SkillResourceDatasetItem extends BaseDatasetItem {
  input: {
    user: any;
    goal: any;
  };
  expected: {
    minResourceCount: number;
    expectedProviders?: string[];
    expectedResourceTypes?: string[];
    expectedResourceUrls?: string[];
  };
}

export interface ChallengeGeneratorDatasetItem extends BaseDatasetItem {
  input: {
    user: any;
    goal: any;
    resource: any;
    challenge: {
      id: string;
      goalId: string;
      sectionId: string;
      sectionTitle: string;
      sectionTopics: string[] | null;
      difficulty: 'easy' | 'medium' | 'hard';
      status: 'locked' | 'pending' | 'generating' | 'complete' | 'failed';
      totalQuestions: number;
      errorMessage: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  expected: {
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard';
  };
}
