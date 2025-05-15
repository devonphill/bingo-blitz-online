
import { useState, useEffect, useCallback } from 'react';
import { getSingleSourceConnection, EVENT_TYPES } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';

// Extend the EVENT_TYPES with additional events we need
const EXTENDED_EVENT_TYPES = {
  ...EVENT_TYPES,
  WIN_PATTERN_UPDATED: 'win-pattern-updated',
  GAME_STATUS_UPDATED: 'game-status-updated',
  CLAIM_VALIDATING_TKT: 'claim-validating-ticket'
};

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
      const connection = getSingleSourceConnection();
      
      // Connect to session
      connection.connect(sessionId);
      
      // Setup connection status listener
      const cleanup = connection.addConnectionListener((connected) => {
        setIsConnected(connected);
        if (connected) {
          setLastError(null);
        }
      });
      
      setIsConnected(connection.isConnected());
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
      const connection = getSingleSourceConnection();
      
      logWithTimestamp(`[${instanceId}] Setting up listener for event: ${eventType}`, 'info');
      
      // Add listener for the event using SingleSourceTrueConnections
      const cleanup = connection.listenForEvent<T>(eventType, (payload) => {
        logWithTimestamp(`[${instanceId}] Received event: ${eventType}`, 'info');
        console.log(`Full payload for ${eventType}:`, payload);
        handler(payload);
      });
      
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
    listenForEvent,
    EVENTS: EXTENDED_EVENT_TYPES  // Expose the extended event types
  };
}
