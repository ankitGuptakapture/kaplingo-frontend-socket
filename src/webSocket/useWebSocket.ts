import { useEffect, useRef } from 'react';
import { webSocketService, type EventCallback } from './index';

interface UseWebSocketOptions {
  url: string;
  options?: Record<string, any>;
  events?: Record<string, EventCallback>;
}


export function useWebSocket({ url, options, events }: UseWebSocketOptions) {
 
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    webSocketService.connect(url, options);

    if (eventsRef.current) {
      Object.entries(eventsRef.current).forEach(([event, callback]) => {
        webSocketService.on(event, callback);
      });
    }

    // Cleanup on unmount
    return () => {
      if (eventsRef.current) {
        Object.entries(eventsRef.current).forEach(([event, callback]) => {
          webSocketService.off(event, callback);
        });
      }
    };
  }, [url, JSON.stringify(options), JSON.stringify(events)]);
  return {
    emit: webSocketService.emit.bind(webSocketService),
    disconnect: webSocketService.disconnect.bind(webSocketService),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService),
  };
} 