
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { EVENT_TYPES } from '@/constants/websocketConstants';

export type WebSocketConnectionStatus = ConnectionState | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CONNECTING' | 'JOINING' | 'JOINED' | 'unknown';

/**
 * A React hook to interact with the WebSocket service
 * @param sessionId Session ID to connect to
 * @returns WebSocket utilities 
 */
export function useWebSocket(sessionId: string | null | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const [isWsReady, setIsWsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionStatus>('disconnected');
  
  // Instance ID for logging
  const instanceId = useRef(`wsHook-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Get singleton connection
  const connection = getSingleSourceConnection();

  // Expose event types from constants
  const EVENTS = EVENT_TYPES;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot connect: No session ID`, 'warn');
      setLastError('No session ID provided');
      setConnectionState('disconnected');
      setIsWsReady(false);
      return () => {};
    }
    
    try {
      // Check if connection service is initialized
      const isInitialized = connection.isServiceInitialized();
      setIsWsReady(isInitialized);
      
      if (!isInitialized) {
        logWithTimestamp(`[${instanceId}] WebSocket service not initialized yet`, 'warn');
        setConnectionState('connecting');
        return () => {};
      }
      
      // Connect to session
      connection.connect(sessionId);
      
      // Setup connection status listener
      const cleanup = connection.addConnectionListener((connected) => {
        setIsConnected(connected);
        // Update the connection state based on the connection status
        setConnectionState(connected ? 'connected' : 'disconnected');
        setIsWsReady(connected);
        
        if (connected) {
          setLastError(null);
        }
      });
      
      // Also set up status listener to get real-time service initialization updates
      const statusCleanup = connection.addStatusListener((status, isServiceInitialized) => {
        setIsWsReady(isServiceInitialized);
        setConnectionState(status);
      });
      
      setIsConnected(connection.isConnected());
      // Set initial connection state
      setConnectionState(connection.isConnected() ? 'connected' : 'disconnected');
      setIsWsReady(connection.isServiceInitialized());
      setLastError(null);
      
      logWithTimestamp(`[${instanceId}] Connected to WebSocket for session ${sessionId}. Service ready: ${isInitialized}`, 'info');
      
      return () => {
        cleanup();
        statusCleanup();
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`[${instanceId}] WebSocket connection error: ${errorMsg}`, 'error');
      setLastError(`Connection error: ${errorMsg}`);
      setIsConnected(false);
      setConnectionState('error');
      setIsWsReady(false);
      return () => {};
    }
  }, [sessionId, instanceId, connection]);
  
  // Disconnect function
  const disconnect = useCallback(() => {
    logWithTimestamp(`[${instanceId}] Manually disconnecting WebSocket`, 'info');
    setIsConnected(false);
    setConnectionState('disconnected');
    setIsWsReady(false);
    return () => {};
  }, [instanceId]);
  
  // Listen for a specific event with added validation
  const listenForEvent = useCallback(<T>(
    eventType: string, 
    handler: (data: T) => void
  ) => {
    // Skip if no session ID
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot listen for event: No session ID`, 'warn');
      return () => {};
    }
    
    // Validate event type - critical fix
    if (!eventType) {
      logWithTimestamp(`[${instanceId}] Cannot listen for undefined event type`, 'error');
      return () => {};
    }
    
    // Check if connection service is initialized
    if (!connection.isServiceInitialized()) {
      logWithTimestamp(`[${instanceId}] Cannot add listener: WebSocket service not initialized yet`, 'warn');
      return () => {};
    }
    
    try {
      logWithTimestamp(`[${instanceId}] Setting up listener for event: ${eventType}`, 'info');
      
      // Determine the appropriate channel name based on event type
      const channelName = eventType.includes('claim') ? 'claim-updates' : 'game-updates';
      
      // Use the singleton connection to listen for events
      const cleanup = connection.listenForEvent<T>(channelName, eventType, (payload) => {
        logWithTimestamp(`[${instanceId}] Received event: ${eventType}`, 'info');
        console.log(`Full payload for ${eventType}:`, payload);
        handler(payload);
      });
      
      logWithTimestamp(`[${instanceId}] Listening for event ${eventType} on session ${sessionId}`, 'info');
      
      // Return cleanup function
      return cleanup;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`[${instanceId}] Error setting up event listener: ${errorMsg}`, 'error');
      return () => {};
    }
  }, [sessionId, instanceId, connection]);
  
  // Auto-connect when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] No session ID provided, skipping auto-connect`, 'warn');
      setIsWsReady(false);
      return;
    }
    
    logWithTimestamp(`[${instanceId}] Auto-connecting to session ${sessionId}`, 'info');
    const cleanup = connect();
    
    // Set up a separate effect to monitor service initialization status
    const checkServiceInitialized = () => {
      const isInitialized = connection.isServiceInitialized();
      setIsWsReady(isInitialized);
      if (!isInitialized) {
        // Check again in 1 second
        setTimeout(checkServiceInitialized, 1000);
      }
    };
    
    // Start checking if not ready
    if (!connection.isServiceInitialized()) {
      checkServiceInitialized();
    }
    
    // Only call the specific listener cleanup function
    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up connection listener for session ${sessionId}`, 'info');
      cleanup();
      // We explicitly do NOT call any global disconnect here to preserve shared channels
    };
  }, [sessionId, connect, instanceId, connection]);
  
  return {
    isConnected,
    isWsReady,
    connectionState,
    lastError,
    connect,
    disconnect,
    listenForEvent,
    EVENTS  // Expose the event types
  };
}
