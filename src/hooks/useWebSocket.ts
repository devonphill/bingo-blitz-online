
import { useState, useEffect, useCallback } from 'react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { WebSocketConnectionStatus } from '@/types/websocket';

/**
 * A React hook to interact with the WebSocket service
 * @param sessionId Session ID to connect to
 * @returns WebSocket utilities 
 */
export function useWebSocket(sessionId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionStatus>('disconnected');
  
  // Instance ID for logging
  const instanceId = `wsHook-${Math.random().toString(36).substring(2, 9)}`;
  
  // Get singleton connection
  const connection = getSingleSourceConnection();
  const EVENTS = connection.constructor['EVENT_TYPES'];

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot connect: No session ID`, 'warn');
      setLastError('No session ID provided');
      setConnectionState('disconnected');
      return () => {};
    }
    
    try {
      // Connect to session
      connection.connect(sessionId);
      
      // Setup connection status listener
      const cleanup = connection.addConnectionListener((connected) => {
        setIsConnected(connected);
        // Update the connection state based on the connection status
        setConnectionState(connected ? 'SUBSCRIBED' : 'CLOSED');
        if (connected) {
          setLastError(null);
        }
      });
      
      setIsConnected(connection.isConnected());
      // Set initial connection state
      setConnectionState(connection.isConnected() ? 'SUBSCRIBED' : 'CLOSED');
      setLastError(null);
      logWithTimestamp(`[${instanceId}] Connected to WebSocket for session ${sessionId}`, 'info');
      
      return cleanup;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`[${instanceId}] WebSocket connection error: ${errorMsg}`, 'error');
      setLastError(`Connection error: ${errorMsg}`);
      setIsConnected(false);
      setConnectionState('error');
      return () => {};
    }
  }, [sessionId, instanceId, connection]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setConnectionState('disconnected');
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
      logWithTimestamp(`[${instanceId}] Setting up listener for event: ${eventType}`, 'info');
      
      // Use the singleton connection to listen for events
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
  }, [sessionId, instanceId, connection]);
  
  // Auto-connect when sessionId changes
  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup();
    };
  }, [sessionId, connect, disconnect]);
  
  return {
    isConnected,
    connectionState,
    lastError,
    connect,
    disconnect,
    listenForEvent,
    EVENTS  // Expose the event types
  };
}
