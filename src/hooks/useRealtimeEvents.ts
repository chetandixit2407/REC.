import { useEffect, useRef, useState, useCallback } from 'react';
import type { UserRole } from '../types/index.ts';

interface RealtimeOptions {
  role: UserRole;
  userId?: string;
  onEvent?: (event: { type: string; payload?: any }) => void;
}

export function useRealtimeEvents({ role, userId, onEvent }: RealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload?: any; timestamp: number } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/events?role=${encodeURIComponent(role)}&userId=${encodeURIComponent(userId || '')}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLastEvent({ ...data, timestamp: Date.now() });
        if (onEventRef.current) {
          onEventRef.current(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE payload', err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto retries, but we record disconnected state
    };
  }, [role, userId]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    lastEvent,
    reconnect: connect,
  };
}
