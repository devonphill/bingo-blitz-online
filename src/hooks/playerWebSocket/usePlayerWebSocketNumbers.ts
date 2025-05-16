
import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useSessionContext } from '@/contexts/SessionProvider';
import { useWebSocket } from '@/hooks/useWebSocket';
import { loadStoredNumbers, saveNumbersToStorage } from './storageUtils';
import { fetchCalledNumbers } from './databaseUtils';

// Interface for number called payload
interface NumberCalledPayload {
  number: number;
  calledNumbers?: number[]; // Make this optional
  sessionId?: string;
  timestamp?: number;
}

/**
 * Hook for listening to number updates via WebSocket
 * 
 * @param sessionId Session ID to listen for updates from
 * @returns Called numbers and connection state
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined) {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const { currentSession } = useSessionContext();
  
  // Create unique instance ID for this hook
  const instanceId = useRef(`WSNum-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Use the consolidated WebSocket hook
  const { 
    listenForEvent, 
    EVENTS, 
    isConnected, 
    connectionState,
    connect
  } = useWebSocket(sessionId);
  
  // Custom log helper
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logWithTimestamp(`[${instanceId}] ${message}`, level);
  }, [instanceId]);
  
  // Load initial numbers from storage and database
  useEffect(() => {
    if (!sessionId) {
      log('No session ID provided, skipping initial load', 'warn');
      return;
    }

    // First try to load from local storage for immediate display
    const storedData = loadStoredNumbers(sessionId);
    if (storedData) {
      log(`Loaded ${storedData.calledNumbers.length} numbers from storage`, 'info');
      setNumbers(storedData.calledNumbers);
      setLastCalledNumber(storedData.lastCalledNumber);
      setLastUpdateTime(storedData.timestamp);
    }

    // Then fetch from database to ensure we have latest data
    fetchCalledNumbers(sessionId).then(dbNumbers => {
      if (dbNumbers && dbNumbers.length > 0) {
        log(`Fetched ${dbNumbers.length} numbers from database`, 'info');
        setNumbers(dbNumbers);
        setLastCalledNumber(dbNumbers[dbNumbers.length - 1]);
        setLastUpdateTime(Date.now());
        
        // Save to storage for future loads
        saveNumbersToStorage(sessionId, dbNumbers, dbNumbers[dbNumbers.length - 1], Date.now());
      }
    });
  }, [sessionId, log]);
  
  // Set up event listeners for number updates
  useEffect(() => {
    if (!sessionId) {
      log('No session ID provided, skipping event listener setup', 'warn');
      return;
    }
    
    // Ensure WebSocket is connected before setting up listeners
    if (!isConnected) {
      log(`WebSocket not ready (state: ${connectionState}), deferring number listener setup`, 'warn');
      return;
    }
    
    log(`Setting up listeners for session ${sessionId}`, 'info');
    
    // Handle new number broadcasts
    const handleNumberUpdate = (data: NumberCalledPayload) => {
      const { number } = data;
      const receivedNumbersList = data.calledNumbers || [];
      
      log(`Received number update: ${number}, total numbers: ${receivedNumbersList.length || 0}`, 'info');
      
      const timestamp = Date.now();
      
      if (receivedNumbersList && Array.isArray(receivedNumbersList) && receivedNumbersList.length > 0) {
        setNumbers(receivedNumbersList);
        // Save to local storage
        saveNumbersToStorage(sessionId, receivedNumbersList, number, timestamp);
      } else {
        // If we only got the new number, append it
        const updatedNumbers = [...numbers, number];
        setNumbers(updatedNumbers);
        // Save to local storage
        saveNumbersToStorage(sessionId, updatedNumbers, number, timestamp);
      }
      
      setLastCalledNumber(number);
      setLastUpdateTime(timestamp);
    };
    
    // Handle game reset
    const handleGameReset = () => {
      log('Game reset detected', 'info');
      setNumbers([]);
      setLastCalledNumber(null);
      setLastUpdateTime(Date.now());
      
      // Clear storage
      saveNumbersToStorage(sessionId, [], null, Date.now());
    };
    
    // Set up listeners using the useWebSocket hook
    const numberCleanup = listenForEvent(
      EVENTS.NUMBER_CALLED,
      handleNumberUpdate
    );
    
    const resetCleanup = listenForEvent(
      EVENTS.GAME_RESET,
      handleGameReset
    );
    
    // Clean up on unmount/change - call both cleanup functions
    return () => {
      log('Cleaning up number update listeners', 'info');
      numberCleanup();
      resetCleanup();
    };
  }, [sessionId, log, listenForEvent, EVENTS, isConnected, connectionState, numbers]);
  
  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (sessionId) {
      log(`Manually reconnecting to session ${sessionId}`, 'info');
      connect();
      
      // Re-fetch data from database
      fetchCalledNumbers(sessionId).then(dbNumbers => {
        if (dbNumbers && dbNumbers.length > 0) {
          log(`Re-fetched ${dbNumbers.length} numbers from database`, 'info');
          setNumbers(dbNumbers);
          setLastCalledNumber(dbNumbers[dbNumbers.length - 1]);
          setLastUpdateTime(Date.now());
        }
      });
    }
  }, [sessionId, log, connect]);

  return {
    calledNumbers: numbers,
    lastCalledNumber,
    isConnected,
    connectionState,
    lastUpdateTime,
    reconnect
  };
}
