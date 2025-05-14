import { useState, useEffect, useCallback } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { numberCallingService } from '@/services/number-calling';

/**
 * Hook for players to subscribe to number calls
 */
export function usePlayerNumbers(sessionId: string | null | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Subscribe to number updates when session ID changes
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Subscribing to number updates for session: ${sessionId}`, 'info');
    
    // Subscribe to the number calling service
    const unsubscribe = numberCallingService.subscribe(sessionId, (number, numbers) => {
      if (number === null) {
        // Handle reset
        setCalledNumbers([]);
        setLastCalledNumber(null);
      } else {
        setCalledNumbers(numbers);
        setLastCalledNumber(number);
      }
    });
    
    setIsSubscribed(true);
    
    // Clean up on unmount or session change
    return () => {
      logWithTimestamp(`Unsubscribing from number updates for session: ${sessionId}`, 'info');
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [sessionId]);
  
  // Function to manually refresh numbers
  const refreshNumbers = useCallback(async () => {
    // Implementation would depend on your API for fetching current numbers
    logWithTimestamp('Manual refresh of numbers requested', 'info');
    // For now this is a placeholder - would need database access
  }, []);
  
  return {
    calledNumbers,
    lastCalledNumber,
    isSubscribed,
    refreshNumbers
  };
}
