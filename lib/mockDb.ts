export interface User {
  id: string;
  role: string;
  skills: string[];
  careerGoals: string[];
}

export interface AvailableSlot {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface WeeklyAvailability {
  userId: string;
  startDate: string;
  totalHours: number;
  availableSlots: AvailableSlot[];
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  reasoning: string;
  resources?: Resource[];
  roadmap?: RoadmapStep[];
  plan?: Plan;
}

export interface Resource {
  title: string;
  link: string;
  reasoning: string;
  provider: string;
  approximateHours: number;
  relevancePercentage: number;
  sections: ResourceSection[];
}

interface ResourceSection {
  skill: string;
  location: string;
}

export type RoadmapStepStatus = 'pending' | 'started' | 'completed';

export interface Timeline {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface RoadmapStep {
  step: string;
  description: string;
  resources: Resource[];
  status: RoadmapStepStatus;
  timeline: Timeline[];
}

export interface Plan {
  totalWeeks: number;
  estimatedCompletionDate: string;
  weeks: {
    weekNumber: number;
    weekStartDate: string;
    focusArea: string;
    sessions: { day: string; startTime: string; endTime: string; roadmapStep: string; activities: string[]; durationMinutes: number }[];
    totalMinutes: number;
    completionPercentage: number;
  }[];
}

export interface SuggestedSkill {
  id: string;
  userId: string;
  name: string;
  priority: number;
  reasoning: string;
}

interface MockDb {
  user: User;
  weeklyAvailability: WeeklyAvailability;
  suggestedSkills: SuggestedSkill[];
  goal: Goal;
  engagement: { missed: number; inactiveDays: number };
  reflections: string[];
}

const createInitialDb = (): MockDb => ({
  user: {
    id: '123',
    role: 'Software Engineer',
    skills: ['JavaScript', 'React', 'Node.js'],
    careerGoals: ['Team lead role', 'Learn AI/ML']
  },
  weeklyAvailability: {
    userId: '123',
    startDate: '2026-01-26',
    totalHours: 1.5,
    availableSlots: [
      { day: 'Monday', startTime: '08:30', endTime: '09:00', durationMinutes: 30 },
      { day: 'Monday', startTime: '16:45', endTime: '17:15', durationMinutes: 30 },
      { day: 'Tuesday', startTime: '08:30', endTime: '09:00', durationMinutes: 30 }
    ]
  } as WeeklyAvailability,
  suggestedSkills: [
    {
      id: '1',
      userId: '123',
      name: 'Leadership',
      priority: 1,
      reasoning:
        'As Alice aims for a team lead role, leadership skills are crucial for effectively managing and motivating the team, facilitating communication, and driving project success.'
    },
    {
      id: '2',
      userId: '123',
      name: 'Machine Learning',
      priority: 2,
      reasoning:
        'Learning machine learning is essential for Alice to achieve her goal of gaining expertise in AI/ML, which will expand her technical capabilities and career opportunities.'
    },
    {
      id: '3',
      userId: '123',
      name: 'Python',
      priority: 3,
      reasoning:
        'Python is a dominant language in AI/ML development. Gaining proficiency in Python will enable Alice to work efficiently on AI/ML projects and deepen her understanding of algorithms and data processing.'
    },
    {
      id: '4',
      userId: '123',
      name: 'Communication Skills',
      priority: 4,
      reasoning:
        'Strong communication skills will help Alice articulate ideas clearly, collaborate with diverse teams, and lead effectively in her prospective team lead role.'
    },
    {
      id: '5',
      userId: '123',
      name: 'Project Management',
      priority: 5,
      reasoning:
        'Knowledge of project management will help Alice plan, execute, and oversee projects, which is important for leadership and ensuring timely delivery of software solutions.'
    },
    {
      id: '6',
      userId: '123',
      name: 'Data Science',
      priority: 6,
      reasoning:
        'Understanding data science concepts complements AI/ML learning by providing skills in data analysis, visualization, and interpretation, which are valuable in AI projects.'
    },
    {
      id: '7',
      userId: '123',
      name: 'Cloud Computing',
      priority: 7,
      reasoning:
        'Familiarity with cloud platforms (like AWS, Azure) is increasingly important for deploying AI/ML models and scalable applications, aligning with modern software engineering practices.'
    },
    {
      id: '8',
      userId: '123',
      name: 'Mentoring',
      priority: 8,
      reasoning:
        'Mentoring skills help in guiding junior developers, which is a valuable aspect of a team lead role, fostering team growth and knowledge sharing.'
    },
    {
      id: '9',
      userId: '123',
      name: 'Problem-Solving',
      priority: 9,
      reasoning:
        'Advanced problem-solving skills enable Alice to tackle complex technical challenges and lead innovative solutions in both software engineering and AI/ML projects.'
    },
    {
      id: '10',
      userId: '123',
      name: 'Agile Methodologies',
      priority: 10,
      reasoning:
        'Understanding Agile methodologies supports effective team collaboration and iterative product development, which are crucial for leadership in software teams.'
    }
  ] as SuggestedSkill[],
  goal: {
    id: '123',
    userId: '123',
    name: 'Leadership',
    reasoning:
      'As Alice aims for a team lead role, leadership skills are crucial for effectively managing and motivating the team, facilitating communication, and driving project success.',
    resources: [
      {
        title: 'Developing Leadership Skills for Engineers',
        link: 'https://www.coursera.org/learn/leadership-engineers',
        reasoning:
          'This course is designed specifically for engineers like Alice to build foundational leadership skills, focusing on managing technical teams, decision-making, and communication strategies important for a team lead role.',
        provider: 'Coursera',
        approximateHours: 8,
        relevancePercentage: 95,
        sections: [{ skill: 'Team Management', location: 'Module 1-3' }]
      },
      {
        title: 'Harvard Business Review Leadership Articles',
        link: 'https://hbr.org/topic/leadership',
        reasoning:
          'A collection of insightful articles from HBR offering practical leadership advice and strategies that Alice can apply to lead and motivate her team effectively.',
        provider: 'Harvard Business Review',
        approximateHours: 4,
        relevancePercentage: 85,
        sections: [{ skill: 'Leadership Strategy', location: 'Featured Articles' }]
      },
      {
        title: 'TED Talk: How Great Leaders Inspire Action',
        link: 'https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action',
        reasoning:
          'This talk provides inspiring perspectives on leadership and motivation, helping Alice understand how to inspire her team with a clear vision and purpose.',
        provider: 'TED',
        approximateHours: 0.5,
        relevancePercentage: 80,
        sections: [{ skill: 'Inspiration', location: 'Full Talk' }]
      },
      {
        title: 'Book: The Five Dysfunctions of a Team',
        link: 'https://www.tablegroup.com/books/dysfunctions',
        reasoning:
          'This book helps leaders understand common team challenges and how to overcome them, which is valuable for Alice as she prepares to lead and cultivate a high-performing team.',
        provider: 'Table Group',
        approximateHours: 6,
        relevancePercentage: 90,
        sections: [{ skill: 'Team Dynamics', location: 'Chapters 1-5' }]
      }
    ]
  },
  engagement: { missed: 0, inactiveDays: 0 },
  reflections: []
});

// Use globalThis to persist the db across module reloads in development
const globalForDb = globalThis as unknown as { mockDb: MockDb | undefined };

export const db: MockDb = globalForDb.mockDb ?? createInitialDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.mockDb = db;
}
