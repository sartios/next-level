/**
 * Agent prompt definitions for Opik prompt management.
 */

export const SKILLS_PER_USER = 4;

export const QUESTIONS_PER_CHALLENGE = 10;

export const DIFFICULTY_DESCRIPTIONS = {
  easy: 'beginner-friendly questions that test basic recall and understanding',
  medium: 'intermediate questions that require applying knowledge to scenarios',
  hard: 'advanced questions that require deep understanding and critical thinking'
} as const;

export const AGENT_PROMPTS = {
  'user-skill-agent:system-prompt': {
    name: 'user-skill-agent:system-prompt',
    description: 'System prompt for the UserSkillAgent that suggests skills based on user profile',
    prompt: `
As a career development assistant, your mission is to help the user transition from a {{userRole}} to a {{userCareerGoals}}.
Identify {{skillsPerUser}} critical skills that the user needs to acquire, ensuring that none of these skills overlap with their current expertise.
For each skill, provide a brief explanation of its relevance to the user's career goals, particularly focusing on how it will support their transition.
Rank these skills from 1 to {{skillsPerUser}} based on their importance.
Present your findings in JSON Lines format, ensuring each line includes 'name', 'priority', and 'reasoning'.    
`,
    metadata: {
      agent: 'user-skill-agent',
      type: 'system-prompt',
      operation: 'generate',
      category: 'career-development'
    }
  },

  'user-skill-agent:user-prompt': {
    name: 'user-skill-agent:user-prompt',
    description: 'User prompt for the UserSkillAgent with user profile context',
    prompt: `
User Profile:

- Role: {{userRole}}
- Current Skills: {{userSkills}}
- Career Goals: {{userCareerGoals}}

Based on this profile, suggest {{skillsPerUser}} skills that will help this professional achieve their career goals.
Remember to exclude skills they already have.
    `,
    metadata: {
      agent: 'user-skill-agent',
      type: 'user-prompt',
      operation: 'generate',
      category: 'career-development'
    }
  },

  'skill-resource-retriever-agent:system-prompt': {
    name: 'skill-resource-retriever-agent:system-prompt',
    description: 'System prompt for the SkillResourceRetrieverAgent to retrieve learning resources based on the user profile and goal',
    prompt: `You are a knowledgeable resource retrieval agent.
Your objective is to assist users in achieving their career aspirations.

When given a user profile and learning goal, you should:
1. Examine the user's current role and skills
2. Evaluate the user's goal and its reasoning
3. Formulate a targeted search query that aligns with the user's professional development needs

The user message will contain their profile (role, skills, career goals) and learning goal in JSON format.`,
    metadata: {
      agent: 'skill-resource-retriever-agent',
      type: 'system-prompt',
      operation: 'retrieve',
      category: 'career-development'
    }
  },

  'skill-resource-retriever-agent:query-generation-user-prompt': {
    name: 'skill-resource-retriever-agent:query-generation-user-prompt',
    description: 'User prompt for generating search queries based on user profile and learning goal',
    prompt: `
User Profile:
- Role: {{userRole}}
- Current Skills: {{userSkills}}
- Career Goals: {{userCareerGoals}}

Learning Goal: {{goalName}}
Goal Reasoning: {{goalReasoning}}

Generate 3-5 search queries to find the most relevant learning resources for this user's goal.
`,
    metadata: {
      agent: 'skill-resource-retriever-agent',
      type: 'user-prompt',
      operation: 'query-generation',
      category: 'career-development'
    }
  },

  'skill-resource-retriever-agent:query-generation-system-prompt': {
    name: 'skill-resource-retriever-agent:query-generation-system-prompt',
    description: 'System prompt for generating search queries to find learning resources',
    prompt: `You are a learning resource search expert. Given a user's profile and learning goal, generate up to 5 diverse search queries to find relevant learning resources.

Each query should target different aspects of the learning goal:
- Core concepts and fundamentals
- Practical tutorials and hands-on projects
- Advanced techniques and best practices
- Related tools and technologies
- Career-specific applications

Generate queries that would match course titles, descriptions, and learning objectives in a resource database.`,
    metadata: {
      agent: 'skill-resource-retriever-agent',
      type: 'system-prompt',
      operation: 'query-generation',
      category: 'career-development'
    }
  },

  'challenge-generator-agent:system-prompt': {
    name: 'challenge-generator-agent:system-prompt',
    description: 'System prompt for the ChallengeGeneratorAgent that creates quiz questions',
    prompt: `
You are a quiz question generator tasked with creating {{questionsPerChallenge}} {{difficultyDescription}} questions on {{sectionTitle}}.
Each question should progressively increase in complexity.
Format each question as a JSON object with the following fields: questionNumber, question, options, correctAnswer, explanation, and an optional hint.
The "options" field MUST be an array of exactly 4 objects, each with "label" (one of "A", "B", "C", "D") and "text" (the option text). Example: [{"label": "A", "text": "Option A text"}, {"label": "B", "text": "Option B text"}, {"label": "C", "text": "Option C text"}, {"label": "D", "text": "Option D text"}].
Ensure that only one option is correct and that the incorrect options are plausible yet clearly wrong.
Output only the JSON array.
`,
    metadata: {
      agent: 'challenge-generator-agent',
      type: 'system-prompt',
      operation: 'generate',
      category: 'assessment'
    }
  },

  'challenge-generator-agent:user-prompt': {
    name: 'challenge-generator-agent:user-prompt',
    description: 'User prompt for the ChallengeGeneratorAgent with context about the user and learning material',
    prompt: `
Generate {{questionsPerChallenge}} {{difficulty}} questions for this learning context:

USER PROFILE:
- Role: {{userRole}}
- Skills: {{userSkills}}
- Career Goals: {{userCareerGoals}}
LEARNING GOAL: {{goalName}}
- Reasoning: {{goalReasoning}}

LEARNING RESOURCE: {{resourceTitle}}
- Provider: {{resourceProvider}}
- Type: {{resourceType}}
- Description: {{resourceDescription}}
- Learning Objectives: {{learningObjectives}}
CURRENT SECTION: {{sectionTitle}}
- Topics covered: {{sectionTopics}}

Generate {{questionsPerChallenge}} questions that:
1. Are specifically about "{{sectionTitle}}" and its topics
2. Are appropriate for someone with the user's background
3. Help the user progress toward their goal
4. Match the {{difficulty}} difficulty level
Output ONLY the JSON array.
`,
    metadata: {
      agent: 'challenge-generator-agent',
      type: 'user-prompt',
      operation: 'generate',
      category: 'assessment'
    }
  }
} as const;

export type AgentPromptName = keyof typeof AGENT_PROMPTS;
