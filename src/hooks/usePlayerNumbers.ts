
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
      const currentNumbers = numberService.getCalledNumbers(sessionId);
      if (currentNumbers.length > 0) {
        setCalledNumbers(currentNumbers);
        setLastCalledNumber(numberService.getLastCalledNumber(sessionId));
      }
      
      setIsConnected(true);
      
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
  const refreshNumbers = useCallback(() => {
    if (!sessionId) return;
    
    const numberService = getNumberCallingService();
    const currentNumbers = numberService.getCalledNumbers(sessionId);
    setCalledNumbers(currentNumbers);
    setLastCalledNumber(numberService.getLastCalledNumber(sessionId));
  }, [sessionId]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    refreshNumbers
  };
}
