
import { useState, useEffect } from 'react';
import { getPlayerNumbersService } from '@/utils/playerNumbersWebSocket';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for direct WebSocket connection to number broadcasting
 * More reliable than the existing mechanism
 */
export function usePlayerWebSocketNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('[usePlayerWebSocketNumbers] No session ID provided', 'info');
      return;
    }

    logWithTimestamp(`[usePlayerWebSocketNumbers] Setting up connection for session ${sessionId}`, 'info');
    setIsConnected(true);
    
    // Get initial state
    const service = getPlayerNumbersService();
    const initialNumbers = service.getCalledNumbers(sessionId);
    const initialLastNumber = service.getLastCalledNumber(sessionId);
    
    if (initialNumbers.length > 0) {
      logWithTimestamp(`[usePlayerWebSocketNumbers] Loaded ${initialNumbers.length} numbers, last: ${initialLastNumber}`, 'debug');
      setCalledNumbers(initialNumbers);
      setLastCalledNumber(initialLastNumber);
    }
    
    // Subscribe to updates
    const unsubscribe = service.subscribeToSession(sessionId, (number, allNumbers) => {
      if (number === null) {
        // Handle reset event
        logWithTimestamp(`[usePlayerWebSocketNumbers] Game has been reset, clearing numbers`, 'info');
        setCalledNumbers([]);
        setLastCalledNumber(null);
        return;
      }
      
      logWithTimestamp(`[usePlayerWebSocketNumbers] Received new number: ${number}, total: ${allNumbers.length}`, 'info');
      setLastCalledNumber(number);
      setCalledNumbers([...allNumbers]);
      setLastUpdateTime(Date.now());
    });

    return () => {
      logWithTimestamp(`[usePlayerWebSocketNumbers] Unsubscribing from session ${sessionId}`, 'debug');
      unsubscribe();
      setIsConnected(false);
    };
  }, [sessionId]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    lastUpdateTime
  };
}
