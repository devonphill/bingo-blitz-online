import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { setupNumberUpdateListeners } from './webSocketManager';
import { WebSocketNumbersState } from './types';
import { loadStoredNumbers, saveNumbersToStorage } from './storageUtils';
import { fetchCalledNumbers } from './databaseUtils';

/**
 * Hook for subscribing to real-time called numbers via WebSockets
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined): WebSocketNumbersState {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const instanceId = useRef(`wsNum-${Math.random().toString(36).substring(2, 9)}`);
  
  // Load numbers from localStorage on init
  useEffect(() => {
    if (sessionId) {
      const stored = loadStoredNumbers(sessionId);
      if (stored) {
        setCalledNumbers(stored.calledNumbers);
        setLastCalledNumber(stored.lastCalledNumber);
        setLastUpdateTime(stored.timestamp);
      }
    }
  }, [sessionId]);
  
  // When a new number is received
  const handleNumberUpdate = useCallback((number: number, allNumbers: number[]) => {
    if (!number) return;
    
    logWithTimestamp(`[${instanceId.current}] Received number update: ${number}`, 'info');
    
    // If we received all numbers, use that
    if (allNumbers && allNumbers.length > 0) {
      setCalledNumbers(allNumbers);
    } else {
      // Otherwise add to our local state
      setCalledNumbers(prev => {
        if (prev.includes(number)) return prev;
        return [...prev, number];
      });
    }
    
    // Set last called number
    setLastCalledNumber(number);
    
    // Update timestamp
    const timestamp = Date.now();
    setLastUpdateTime(timestamp);
    
    // Save to localStorage
    if (sessionId) {
      saveNumbersToStorage(sessionId, allNumbers.length > 0 ? allNumbers : [...calledNumbers, number], number, timestamp);
    }
  }, [calledNumbers, sessionId]);
  
  // Handle game reset
  const handleGameReset = useCallback(() => {
    logWithTimestamp(`[${instanceId.current}] Received game reset`, 'info');
    setCalledNumbers([]);
    setLastCalledNumber(null);
    
    // Clear localStorage
    if (sessionId) {
      saveNumbersToStorage(sessionId, [], null, Date.now());
    }
  }, [sessionId]);
  
  // Setup WebSocket listeners
  useEffect(() => {
    if (!sessionId) return;
    
    // Set up listeners
    const cleanup = setupNumberUpdateListeners(
      sessionId,
      handleNumberUpdate,
      handleGameReset,
      instanceId.current
    );
    
    // Fetch initial numbers
    const fetchInitial = async () => {
      try {
        const numbers = await fetchCalledNumbers(sessionId);
        
        if (numbers && numbers.length > 0) {
          setCalledNumbers(numbers);
          setLastCalledNumber(numbers[numbers.length - 1]);
          
          // Save to localStorage
          saveNumbersToStorage(sessionId, numbers, numbers[numbers.length - 1], Date.now());
        }
      } catch (error) {
        logWithTimestamp(`[${instanceId.current}] Error fetching initial numbers: ${error}`, 'error');
      }
    };
    
    fetchInitial();
    
    // Cleanup listeners on unmount
    return cleanup;
  }, [sessionId, handleNumberUpdate, handleGameReset]);
  
  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Manually reconnecting WebSocket numbers`, 'info');
    
    // Re-fetch numbers
    const fetchAgain = async () => {
      try {
        const numbers = await fetchCalledNumbers(sessionId);
        
        if (numbers && numbers.length > 0) {
          setCalledNumbers(numbers);
          setLastCalledNumber(numbers[numbers.length - 1]);
          setLastUpdateTime(Date.now());
        }
      } catch (error) {
        logWithTimestamp(`[${instanceId.current}] Error re-fetching numbers: ${error}`, 'error');
      }
    };
    
    fetchAgain();
  }, [sessionId]);
  
  // Return the state object with getters/setters
  return {
    calledNumbers,
    lastCalledNumber,
    currentNumber: lastCalledNumber, // Alias for compatibility
    numberCallTimestamp: lastUpdateTime, // Alias for compatibility
    isConnected,
    lastUpdateTime,
    reconnect
  };
}
