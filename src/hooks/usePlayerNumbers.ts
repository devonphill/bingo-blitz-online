
import { useState, useEffect } from 'react';
import { getNumberCallingService } from '@/services/NumberCallingService';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for players to receive called numbers
 * Optimized for stable display and reliable updates
 */
export function usePlayerNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Subscribe to number updates from the service with improved stability
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('No session ID provided to usePlayerNumbers', 'info');
      return;
    }
    
    logWithTimestamp(`Setting up player number subscription for session ${sessionId}`, 'info');
    setIsConnected(true);
    
    try {
      // Get or create service for this session
      const service = getNumberCallingService(sessionId);
      
      // Initial state
      const initialNumbers = service.getCalledNumbers();
      const initialLastNumber = service.getLastCalledNumber();
      
      setCalledNumbers(initialNumbers);
      setLastCalledNumber(initialLastNumber);
      setLastUpdateTime(Date.now());
      
      // Subscribe to updates with debounce to avoid flickering
      const unsubscribe = service.subscribe((numbers, last) => {
        // If this is a new number being called (not just reconnecting and getting the same data)
        const isActualUpdate = last !== lastCalledNumber || numbers.length !== calledNumbers.length;
        
        if (isActualUpdate) {
          logWithTimestamp(`Received number update: ${numbers.length} numbers, last: ${last}`, 'info');
          
          // Update state with new data
          setCalledNumbers([...numbers]);
          setLastCalledNumber(last);
          setLastUpdateTime(Date.now());
        }
      });
      
      // Cleanup
      return () => {
        logWithTimestamp(`Cleaning up player number subscription for session ${sessionId}`, 'info');
        unsubscribe();
      };
    } catch (error) {
      setIsConnected(false);
      logWithTimestamp(`Error in usePlayerNumbers: ${error}`, 'error');
    }
  }, [sessionId]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    lastUpdateTime
  };
}
