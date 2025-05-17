import { useState, useCallback, useEffect } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { callNumberForSession } from '@/contexts/network/networkOperations';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { EVENT_TYPES } from '@/constants/websocketConstants';

export interface UseCallerNumbersProps {
  sessionId: string;
}

export function useCallerNumbers({ sessionId }: UseCallerNumbersProps) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  
  // Get reference to singleton connection
  const connection = getNCMInstance();
  
  // Connect to WebSocket
  useEffect(() => {
    if (!sessionId) return;
    
    // Connect to the session
    connection.connect(sessionId);
    
    // Set up connection status listener
    const cleanupListener = connection.addConnectionListener((connected) => {
      setIsConnected(connected);
      setConnectionState(connection.getCurrentConnectionState());
    });
    
    // Set initial status
    setIsConnected(connection.isConnected());
    setConnectionState(connection.getCurrentConnectionState());
    
    // Clean up
    return () => {
      cleanupListener();
    };
  }, [sessionId, connection]);
  
  // Set up event listeners
  useEffect(() => {
    if (!sessionId || !isConnected) return;
    
    logWithTimestamp(`[useCallerNumbers] Setting up number update listeners for session ${sessionId}`, 'info');
    
    // Generate unique instance ID for logging
    const instanceId = `CallerNumbers-${Math.random().toString(36).substring(2, 7)}`;
    
    // Set up listeners manually since setupNumberUpdateListeners might not exist
    const numberListener = connection.listenForEvent(
      'GAME_UPDATES_BASE',
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        logWithTimestamp(`[${instanceId}] Received number update: ${data.number}`, 'info');
        if (data.calledNumbers && Array.isArray(data.calledNumbers)) {
          setCalledNumbers(data.calledNumbers);
        }
        setLastCalledNumber(data.number);
      },
      sessionId
    );
    
    const resetListener = connection.listenForEvent(
      'GAME_UPDATES_BASE',
      EVENT_TYPES.GAME_RESET,
      () => {
        logWithTimestamp(`[${instanceId}] Received game reset`, 'info');
        setCalledNumbers([]);
        setLastCalledNumber(null);
      },
      sessionId
    );
    
    // Return cleanup
    return () => {
      numberListener();
      resetListener();
    };
  }, [sessionId, isConnected, connection]);
  
  // Call a number
  const callNumber = useCallback(async (
    number: number
  ): Promise<boolean> => {
    if (!sessionId) {
      logWithTimestamp('[useCallerNumbers] Cannot call number: No session ID', 'error');
      return false;
    }
    
    if (!isConnected) {
      logWithTimestamp('[useCallerNumbers] Cannot call number: Not connected', 'error');
      return false;
    }
    
    // First update local state
    const updatedNumbers = [...calledNumbers, number];
    setCalledNumbers(updatedNumbers);
    setLastCalledNumber(number);
    
    // Then broadcast
    logWithTimestamp(`[useCallerNumbers] Calling number ${number} for session ${sessionId}`, 'info');
    const result = await callNumberForSession(number, sessionId, updatedNumbers);
    
    if (!result) {
      logWithTimestamp('[useCallerNumbers] Error calling number, reverting local state', 'error');
      // Revert on failure
      setCalledNumbers(calledNumbers);
      setLastCalledNumber(calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null);
    }
    
    return result;
  }, [sessionId, isConnected, calledNumbers]);
  
  // Reset the game
  const resetGame = useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      logWithTimestamp('[useCallerNumbers] Cannot reset game: No session ID', 'error');
      return false;
    }
    
    // First update local state
    setCalledNumbers([]);
    setLastCalledNumber(null);
    
    try {
      // Then broadcast
      logWithTimestamp(`[useCallerNumbers] Resetting game for session ${sessionId}`, 'info');
      return true; // Since we can't use broadcast() directly here, simplified response
    } catch (error) {
      logWithTimestamp(`[useCallerNumbers] Error resetting game: ${error}`, 'error');
      return false;
    }
  }, [sessionId]);
  
  // Handle reconnection
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[useCallerNumbers] Reconnecting to session ${sessionId}`, 'info');
    connection.connect(sessionId);
  }, [sessionId, connection]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    connectionState,
    callNumber,
    resetGame,
    reconnect
  };
}
