
import { useState, useEffect, useCallback } from 'react';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';

export function useWebSocket(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Instance ID for logging
  const instanceId = `wsHook-${Math.random().toString(36).substring(2, 9)}`;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot connect: No session ID`, 'warn');
      setLastError('No session ID provided');
      return;
    }
    
    try {
      const webSocketService = getWebSocketService();
      const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      // Create a simple listener to verify connection
      const cleanup = webSocketService.addListener(
        CHANNEL_NAMES.GAME_UPDATES,
        'broadcast',
        'connection-test',
        () => {} // Empty handler, just for testing connection
      );
      
      setIsConnected(true);
      setLastError(null);
      logWithTimestamp(`[${instanceId}] Connected to WebSocket for session ${sessionId}`, 'info');
      
      return cleanup;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`[${instanceId}] WebSocket connection error: ${errorMsg}`, 'error');
      setLastError(`Connection error: ${errorMsg}`);
      setIsConnected(false);
      return () => {};
    }
  }, [sessionId, instanceId]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    setIsConnected(false);
    logWithTimestamp(`[${instanceId}] Disconnected from WebSocket`, 'info');
  }, [instanceId]);
  
  // Listen for a specific event
  const listenForEvent = useCallback(<T>(
    eventType: string, 
    handler: (data: T) => void
  ) => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot listen for event: No session ID`, 'warn');
      return () => {};
    }
    
    try {
      const webSocketService = getWebSocketService();
      
      // Add listener for the event
      const cleanup = webSocketService.addListener(
        CHANNEL_NAMES.GAME_UPDATES,
        'broadcast',
        eventType,
        (payloadWrapper: any) => {
          const payload = payloadWrapper?.payload;
          if (payload && payload.sessionId === sessionId) {
            handler(payload as T);
          }
        }
      );
      
      logWithTimestamp(`[${instanceId}] Listening for event ${eventType} on session ${sessionId}`, 'info');
      return cleanup;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`[${instanceId}] Error setting up event listener: ${errorMsg}`, 'error');
      return () => {};
    }
  }, [sessionId, instanceId]);
  
  // Auto-connect when sessionId changes
  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup();
      disconnect();
    };
  }, [sessionId, connect, disconnect]);
  
  return {
    isConnected,
    lastError,
    connect,
    disconnect,
    listenForEvent
  };
}
