'use client';

export default function Onboarding() {
  const run = async () => {
    await fetch('/api/agents/skill', { method: 'POST' });
    await fetch('/api/agents/plan', { method: 'POST' });
  };

  return <button onClick={run}>Start My Growth Plan</button>;
}
