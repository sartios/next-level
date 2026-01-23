'use client';

export default function Learn() {
  const apply = async () => {
    await fetch('/api/agents/apply', { method: 'POST' });
  };

  return <button onClick={apply}>Apply Learning</button>;
}
