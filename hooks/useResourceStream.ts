'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface StreamedResource {
  id: string;
  url: string;
  title: string;
  description: string | null;
  provider: string;
  resourceType: 'course' | 'book' | 'tutorial' | 'article';
  learningObjectives: string[];
  targetAudience: string[];
  totalHours: number | null;
  sections: Array<{
    id: string;
    resourceId: string;
    title: string;
    estimatedMinutes: number | null;
    orderIndex: number;
    topics: string[];
  }>;
}

interface UseResourceStreamOptions {
  onResource?: (resource: StreamedResource) => void;
  onError?: (error: Error) => void;
  onFinish?: (resources: StreamedResource[]) => void;
}

interface UseResourceStreamReturn {
  resources: StreamedResource[];
  isLoading: boolean;
  error: Error | null;
  status: string;
  startStream: (userId: string, goalId: string) => void;
  stop: () => void;
}

export function useResourceStream(options: UseResourceStreamOptions = {}): UseResourceStreamReturn {
  const { onResource, onError, onFinish } = options;

  const [resources, setResources] = useState<StreamedResource[]>([]);
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

  const startStream = useCallback(
    (userId: string, goalId: string) => {
      // Close any existing connection
      stop();

      // Reset state
      setResources([]);
      setError(null);
      setIsLoading(true);
      setStatus('Connecting...');

      const eventSource = new EventSource(`/api/users/${userId}/goals/${goalId}/resources/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'token':
              if (data.content) {
                setStatus(data.content);
              } else if (data.toolName) {
                setStatus(`Using: ${data.toolName}...`);
              } else {
                setStatus('Finding resources...');
              }
              break;

            case 'resource':
              if (data.resource) {
                setResources((prev) => {
                  const newResources = [...prev, data.resource];
                  onResource?.(data.resource);
                  return newResources;
                });
                setStatus(`Found: ${data.resource.title}`);
              }
              break;

            case 'complete':
              setIsLoading(false);
              setStatus('');
              eventSource.close();
              if (data.result?.resources) {
                onFinish?.(data.result.resources);
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
    [stop, onResource, onError, onFinish]
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
    resources,
    isLoading,
    error,
    status,
    startStream,
    stop
  };
}
