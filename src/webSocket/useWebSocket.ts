import { useEffect, useRef } from 'react';
import { webSocketService, type EventCallback } from './index';

interface UseWebSocketOptions {
  url: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  events?: Record<string, EventCallback>;
}

export function useWebSocket({ url, onConnect, onDisconnect, events }: UseWebSocketOptions) {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    webSocketService.connect(url);

    webSocketService.on('connect', () => {
      onConnect?.();
    });

    webSocketService.on('disconnect', () => {
      onDisconnect?.();
    });

    if (eventsRef.current) {
      Object.entries(eventsRef.current).forEach(([event, callback]) => {
        webSocketService.on(event, callback);
      });
    }

    return () => {
      if (eventsRef.current) {
        Object.entries(eventsRef.current).forEach(([event, callback]) => {
          webSocketService.off(event, callback);
        });
      }
      webSocketService.off('connect');
      webSocketService.off('disconnect');
    };
  }, [url, onConnect, onDisconnect]);

  return {
    emit: webSocketService.emit.bind(webSocketService),
    disconnect: webSocketService.disconnect.bind(webSocketService),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService),
  };
} 