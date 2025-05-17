
import { useEffect, useState, useCallback } from 'react';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { EVENT_TYPES } from '@/constants/websocketConstants';

interface UsePlayerWebSocketNumbersResult {
  isConnected: boolean;
  connectionState: string;
  lastError: string;
  reconnect: () => void;
  listenForEvent: <T = any>(eventName: string, callback: (data: T) => void) => () => void;
  EVENTS: {
    NUMBER_CALLED: string;
    GAME_RESET: string;
    CLAIM_SUBMITTED: string;
    CLAIM_VALIDATION: string;
  };
}

export const usePlayerWebSocketNumbers = (sessionId?: string): UsePlayerWebSocketNumbersResult => {
  const [lastError, setLastError] = useState('');
  const { isConnected, connectionState, reconnect, connect } = useNetworkStatus();

  // Update connection state and handle errors
  useEffect(() => {
    if (sessionId) {
      const connectionManager = getNCMInstance();
      // Connect to session only if we have a valid sessionId
      connect(sessionId);
    }
  }, [sessionId, connect]);

  // Define a wrapper for listenForEvent specific to this session
  const listenForEvent = useCallback(<T = any>(
    eventName: string, 
    callback: (data: T) => void
  ): (() => void) => {
    if (!sessionId) {
      console.warn('usePlayerWebSocketNumbers: Cannot listen for events without sessionId');
      return () => {};
    }

    const connectionManager = getNCMInstance();
    const channelName = `game_updates-${sessionId}`;
    
    return connectionManager.listenForEvent<T>(channelName, eventName, callback);
  }, [sessionId]);

  return {
    isConnected,
    connectionState,
    lastError,
    reconnect,
    listenForEvent,
    EVENTS: {
      NUMBER_CALLED: EVENT_TYPES.NUMBER_CALLED,
      GAME_RESET: EVENT_TYPES.GAME_RESET,
      CLAIM_SUBMITTED: EVENT_TYPES.CLAIM_SUBMITTED,
      CLAIM_VALIDATION: EVENT_TYPES.CLAIM_VALIDATING,
    }
  };
};

export default usePlayerWebSocketNumbers;
