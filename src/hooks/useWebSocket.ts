
import { useState, useEffect, useCallback } from 'react';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';

// Extend the EVENT_TYPES with additional events we need
const EXTENDED_EVENT_TYPES = {
  ...EVENT_TYPES,
  WIN_PATTERN_UPDATED: 'win-pattern-updated',
  GAME_STATUS_UPDATED: 'game-status-updated',
  CLAIM_VALIDATING_TKT: 'claim-validating-ticket',
  CLAIM_VALIDATION_RESULT: 'claim-validation-result'  // Add this new event type for claim results
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
      
      logWithTimestamp(`[${instanceId}] Setting up listener for event: ${eventType}`, 'info');
      
      // Add listener for the event
      const cleanup = webSocketService.addListener(
        CHANNEL_NAMES.GAME_UPDATES,
        'broadcast',
        eventType,
        (payloadWrapper: any) => {
          logWithTimestamp(`[${instanceId}] Received event: ${eventType}`, 'info');
          console.log(`Full payload for ${eventType}:`, payloadWrapper);
          
          const payload = payloadWrapper?.payload;
          if (payload) {
            // For claim validation events, always process them regardless of sessionId
            // This ensures players see claim validations even if there's a mismatch
            if (eventType === EXTENDED_EVENT_TYPES.CLAIM_VALIDATING_TKT || 
                eventType === EXTENDED_EVENT_TYPES.CLAIM_VALIDATION_RESULT) {
              logWithTimestamp(`[${instanceId}] Processing claim event regardless of session match`, 'info');
              handler(payload as T);
              return;
            }
            
            // For other events, check session matching
            if (!payload.sessionId || payload.sessionId === sessionId) {
              handler(payload as T);
            } else {
              logWithTimestamp(`[${instanceId}] Event ${eventType} sessionId mismatch: ${payload.sessionId} vs ${sessionId}`, 'debug');
            }
          } else {
            logWithTimestamp(`[${instanceId}] Event ${eventType} has no payload`, 'warn');
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
    listenForEvent,
    EVENTS: EXTENDED_EVENT_TYPES  // Expose the extended event types
  };
}
