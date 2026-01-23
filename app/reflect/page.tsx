'use client';

export default function Reflect() {
  const submit = async () => {
    await fetch('/api/agents/reflect', { method: 'POST', body: JSON.stringify({ reflection: 'I felt confident' }) });
  };

  return <button onClick={submit}>Submit Reflection</button>;
}
