
import { useState, useEffect, useCallback } from 'react';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { EVENT_TYPES, WebSocketConnectionStatus } from '@/constants/websocketConstants';

interface UseWebSocketProps {
  sessionId?: string | null;
}

export function useWebSocket(sessionId?: string | null) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  
  const connection = getNCMInstance();

  // Initialize connection status
  useEffect(() => {
    setIsConnected(connection.isConnected());
    setConnectionState(connection.getCurrentConnectionState());
  }, [connection]);
  
  // Set up connection listener
  useEffect(() => {
    if (!sessionId) return;
    
    // Listen for connection status changes
    const cleanup = connection.addOverallStatusListener((status, isReady) => {
      setIsConnected(status === 'connected' && isReady);
      setConnectionState(status);
    });
    
    // Connect to session if sessionId provided
    if (sessionId) {
      connection.connect(sessionId);
    }
    
    return cleanup;
  }, [sessionId, connection]);
  
  // Method to listen for specific events
  const listenForEvent = useCallback(<T = any>(
    eventName: string,
    callback: (data: T) => void,
  ) => {
    if (!sessionId) {
      return () => {}; // Return no-op cleanup if no sessionId
    }
    
    const channelName = `game_updates-${sessionId}`;
    
    // Listen for the specific event on the game updates channel
    return connection.listenForEvent(
      channelName,
      eventName,
      callback
    );
  }, [sessionId, connection]);
  
  // Method to manually reconnect
  const reconnect = useCallback(() => {
    if (sessionId) {
      connection.connect(sessionId);
    }
  }, [sessionId, connection]);
  
  return {
    isConnected,
    connectionState,
    lastError,
    reconnect,
    listenForEvent,
    EVENTS: EVENT_TYPES // Export event types for convenience
  };
}
