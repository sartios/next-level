export const db = {
  user: {
    id: '123',
    name: 'Alice Johnson',
    role: 'Software Engineer',
    skills: ['JavaScript', 'React', 'Node.js'],
    careerGoals: ['Team lead role', 'Learn AI/ML']
  },
  goal: {
    id: '123',
    userId: '123',
    name: 'Python Programming',
    reasoning:
      'Python is widely used in AI/ML development. Gaining proficiency in Python will enable you to implement ML algorithms and work on AI projects.',
    resources: []
  },
  weeklyAvailability: {
    userId: '123',
    startDate: '2026-01-26',
    totalHours: 1.5,
    availableSlots: {
      Monday: [
        { startTime: '08:30', endTime: '09:00', durationMinutes: 30 },
        { startTime: '16:45', endTime: '17:15', durationMinutes: 30 }
      ],
      Tuesday: [{ startTime: '08:30', endTime: '09:00', durationMinutes: 30 }],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    }
  },
  engagement: { missed: 0, inactiveDays: 0 },
  plan: null as unknown,
  reflections: [] as string[]
};
