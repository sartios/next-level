'use client';

import { useState } from 'react';

interface Skill {
  name: string;
  priority: number;
  reasoning: string;
}

export default function Onboarding() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/skill');
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setSkills(data.skills || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={run} disabled={loading}>
        {loading ? 'Generating Skills...' : 'Fetch skills'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <pre>{JSON.stringify(skills, null, 4)}</pre>
    </div>
  );
}
