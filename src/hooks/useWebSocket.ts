
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { EVENT_TYPES, WebSocketConnectionStatus, CONNECTION_STATES, CHANNEL_NAMES } from '@/constants/websocketConstants';

/**
 * A React hook to interact with the centralized WebSocket service (SingleSourceTrueConnections).
 */
export function useWebSocket(externalSessionId?: string | null) {
  const sstc = getSingleSourceConnection();
  
  // Use provided external sessionId directly - no context dependency
  const sessionId = externalSessionId;

  const [isServiceReady, setIsServiceReady] = useState(sstc.isServiceInitialized() && sstc.isConnected());
  const [connectionState, setConnectionState] = useState<WebSocketConnectionStatus>(sstc.getCurrentConnectionState());
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Unique ID for logging instances of this hook
  const instanceId = useRef(`wsHook-${Math.random().toString(36).substring(2, 9)}`).current;

  useEffect(() => {
    logWithTimestamp(`[${instanceId}] Hook mounted/updated. SessionId: ${sessionId}, Current SSTC State: ${sstc.getCurrentConnectionState()}, Service Initialized: ${sstc.isServiceInitialized()}`, 'debug');

    // Listener for overall SSTC status changes
    const handleSSTCStatusChange = (status: WebSocketConnectionStatus, serviceIsInitialized: boolean) => {
      logWithTimestamp(`[${instanceId}] SSTC Status Listener: status=${status}, serviceReady=${serviceIsInitialized}`, 'debug');
      setConnectionState(status);
      setIsServiceReady(serviceIsInitialized && status === CONNECTION_STATES.CONNECTED);
    };

    const cleanupStatusListener = sstc.addStatusListener(handleSSTCStatusChange);
    
    // Initial connect attempt if sessionId is present and service is initialized by SSTC
    if (sessionId && sstc.isServiceInitialized()) {
      logWithTimestamp(`[${instanceId}] SessionId available, calling SSTC connect for session: ${sessionId}`, 'info');
      sstc.connect(sessionId); // Make SSTC aware of the current session
    } else if (!sstc.isServiceInitialized()){
      logWithTimestamp(`[${instanceId}] Deferring SSTC connect: Service not initialized. SessionId: ${sessionId}`, 'warn');
    } else if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Deferring SSTC connect: No session ID.`, 'warn');
    }

    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up useWebSocket hook. SessionId: ${sessionId}`, 'debug');
      cleanupStatusListener();
      // Listeners added via listenForEvent below will be cleaned up by their own returned functions
    };
  }, [sessionId, sstc, instanceId]); // sstc is stable, instanceId is stable

  const listenForEvent = useCallback(
    <T = any>(
      eventName: string,
      callback: (payload: T) => void
    ): (() => void) => {
      if (!sessionId) {
        logWithTimestamp(`[${instanceId}] listenForEvent: No sessionId, cannot add listener for ${eventName}.`, 'warn');
        return () => {};
      }
      if (!isServiceReady) {
        logWithTimestamp(`[${instanceId}] listenForEvent: WebSocket not ready (state: ${connectionState}), deferring listener for ${eventName}.`, 'warn');
        return () => {};
      }
      if (!eventName || typeof eventName !== 'string') {
        logWithTimestamp(`[${instanceId}] listenForEvent: Invalid eventName '${eventName}'. Listener not added.`, 'error');
        return () => {};
      }

      // Determine the channel name based on event type
      const channelNameKey = eventName.includes('claim') ? 'CLAIM_UPDATES_BASE' : 'GAME_UPDATES_BASE';
      
      try {
        // SSTC will construct the full channel name using sessionId
        return sstc.listenForEvent<T>(channelNameKey, eventName, callback, sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setLastError(errorMessage);
        logWithTimestamp(`[${instanceId}] Error setting up listener: ${errorMessage}`, 'error');
        return () => {};
      }
    },
    [sessionId, sstc, isServiceReady, connectionState, instanceId]
  );
  
  // Expose connect method for manual reconnection
  const connect = useCallback(() => {
    if (sessionId) {
      sstc.connect(sessionId);
      return true;
    }
    return false;
  }, [sessionId, sstc]);

  return {
    isConnected: connectionState === CONNECTION_STATES.CONNECTED && isServiceReady,
    isWsReady: isServiceReady, // True if SSTC is initialized and its overall status is 'connected'
    connectionState,
    listenForEvent,
    connect,
    EVENTS: EVENT_TYPES, // For convenience
    sessionId,
    lastError
  };
}
