'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface StreamedSkill {
  name: string;
  reasoning: string;
  priority: number;
}

interface UseSkillStreamOptions {
  apiUrl?: string;
  initialSkills?: StreamedSkill[];
  onSkill?: (skill: StreamedSkill) => void;
  onError?: (error: Error) => void;
  onFinish?: (skills: StreamedSkill[]) => void;
}

interface UseSkillStreamReturn {
  skills: StreamedSkill[];
  isLoading: boolean;
  error: Error | null;
  status: string;
  submit: (userId: string) => void;
  stop: () => void;
}

export function useSkillStream(options: UseSkillStreamOptions = {}): UseSkillStreamReturn {
  const { apiUrl = '/api/skill/stream', initialSkills, onSkill, onError, onFinish } = options;

  const [skills, setSkills] = useState<StreamedSkill[]>(initialSkills ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState('');

  const eventSourceRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsLoading(false);
    setStatus('');
  }, []);

  const submit = useCallback(
    (userId: string) => {
      // Close any existing connection
      stop();

      // Reset state
      setSkills([]);
      setError(null);
      setIsLoading(true);
      setStatus('Connecting...');

      const eventSource = new EventSource(`${apiUrl}?userId=${userId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'token':
              if (data.content) {
                setStatus(data.content);
              } else {
                setStatus('Generating suggestions...');
              }
              break;

            case 'skill':
              if (data.skill) {
                setSkills((prev) => {
                  const newSkills = [...prev, data.skill];
                  onSkill?.(data.skill);
                  return newSkills;
                });
                setStatus(`Found: ${data.skill.name}`);
              }
              break;

            case 'complete':
              setIsLoading(false);
              setStatus('');
              eventSource.close();
              if (data.result?.skills) {
                onFinish?.(data.result.skills);
              }
              break;

            case 'error':
              const err = new Error(data.message || 'Unknown error');
              setError(err);
              setIsLoading(false);
              setStatus('');
              eventSource.close();
              onError?.(err);
              break;
          }
        } catch {
          const parseError = new Error('Failed to parse stream data');
          setError(parseError);
          setIsLoading(false);
          setStatus('');
          eventSource.close();
          onError?.(parseError);
        }
      };

      eventSource.onerror = () => {
        const connectionError = new Error('Connection error. Please try again.');
        setError(connectionError);
        setIsLoading(false);
        setStatus('');
        eventSource.close();
        onError?.(connectionError);
      };
    },
    [apiUrl, stop, onSkill, onError, onFinish]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    skills,
    isLoading,
    error,
    status,
    submit,
    stop
  };
}
