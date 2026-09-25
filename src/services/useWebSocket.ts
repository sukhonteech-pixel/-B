import { useEffect, useRef, useState, useCallback } from 'react';

export type DashboardWsStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface WebSocketState {
  wsStatus: DashboardWsStatus;
  isConnected: boolean; // Dashboard browser WS connection status ONLY
  lastEvent: string | null;
  activeScreenshot: string | null;
  activeJobProgress: {
    jobId: string;
    propertyNo: string;
    progress: number;
    currentStep: string;
    status: string;
  } | null;
}

export function useWebSocket(onEvent?: (event: string, payload: any) => void) {
  const [wsStatus, setWsStatus] = useState<DashboardWsStatus>('CONNECTING');
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null);
  const [activeJobProgress, setActiveJobProgress] = useState<WebSocketState['activeJobProgress']>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    try {
      setWsStatus('CONNECTING');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws?clientType=dashboard`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('CONNECTED');
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { event: eventName, payload } = parsed;

          if (eventName === 'job.progress') {
            setActiveJobProgress({
              jobId: payload.jobId,
              propertyNo: payload.propertyNo,
              progress: payload.progress,
              currentStep: payload.currentStep,
              status: payload.status,
            });
          } else if (eventName === 'job.screenshot') {
            if (payload.screenshot) {
              setActiveScreenshot(payload.screenshot);
            }
          } else if (eventName === 'job.completed' || eventName === 'job.failed' || eventName === 'job.cancelled') {
            setActiveJobProgress((prev) => {
              if (prev && prev.jobId === payload.jobId) {
                return {
                  ...prev,
                  progress: eventName === 'job.completed' ? 100 : prev.progress,
                  status: eventName === 'job.completed' ? 'COMPLETED' : eventName === 'job.failed' ? 'FAILED' : 'CANCELLED',
                  currentStep: eventName === 'job.completed' ? 'Completed' : payload.error || payload.errorMessage || 'Stopped',
                };
              }
              return prev;
            });
          }

          if (onEvent) {
            onEvent(eventName, payload);
          }
        } catch (err) {
          console.error('Error handling WS event:', err);
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('DISCONNECTED');
        // Safe reconnect with backoff
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!isUnmountedRef.current) {
              connect();
            }
          }, 3000);
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('ERROR');
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch (err) {
      console.error('WebSocket connection setup failed:', err);
      setWsStatus('ERROR');
    }
  }, [onEvent]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendEvent = (event: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    }
  };

  return {
    wsStatus,
    isConnected: wsStatus === 'CONNECTED',
    activeScreenshot,
    activeJobProgress,
    sendEvent,
  };
}

