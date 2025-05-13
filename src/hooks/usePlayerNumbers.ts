
import { useEffect, useState, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { getNumberCallingService } from '@/services/number-calling';

/**
 * Hook for tracking called numbers
 */
export function usePlayerNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Initialize and subscribe to number updates
  useEffect(() => {
    if (!sessionId) return;
    
    try {
      // Get number service instance
      const numberService = getNumberCallingService();
      
      // Register update handler
      const unsubscribe = numberService.subscribe(sessionId, (number, allNumbers) => {
        setLastCalledNumber(number);
        setCalledNumbers(allNumbers);
      });
      
      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;
      
      // Initialize with current state if available
      const fetchInitialNumbers = async () => {
        try {
          const currentNumbers = await numberService.getCalledNumbers(sessionId);
          
          // Update state with fetched numbers
          setCalledNumbers(currentNumbers);
          
          if (currentNumbers && currentNumbers.length > 0) {
            const lastNumber = await numberService.getLastCalledNumber(sessionId);
            setLastCalledNumber(lastNumber);
          }
          
          setIsConnected(true);
        } catch (error) {
          logWithTimestamp(`Error fetching initial numbers: ${error}`, 'error');
        }
      };
      
      fetchInitialNumbers();
      
      // Cleanup on unmount
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (error) {
      logWithTimestamp(`Error in usePlayerNumbers: ${error}`, 'error');
      setIsConnected(false);
    }
  }, [sessionId]);
  
  // Manual refresh function 
  const refreshNumbers = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const numberService = getNumberCallingService();
      const currentNumbers = await numberService.getCalledNumbers(sessionId);
      setCalledNumbers(currentNumbers);
      const lastNumber = await numberService.getLastCalledNumber(sessionId);
      setLastCalledNumber(lastNumber);
    } catch (error) {
      logWithTimestamp(`Error refreshing numbers: ${error}`, 'error');
    }
  }, [sessionId]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    refreshNumbers
  };
}
