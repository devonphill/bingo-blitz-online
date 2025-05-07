
import { useState, useEffect, useCallback } from 'react';
import { getNumberCallingService } from '@/services/NumberCallingService';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for managing called numbers from the caller's perspective
 * This hook interfaces with NumberCallingService for performance and resilience
 */
export function useCallerNumbers(sessionId: string | undefined, gameType: string = 'mainstage') {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isCallInProgress, setIsCallInProgress] = useState(false);

  // Calculate remaining numbers based on game type and called numbers
  const remainingNumbers = useCallback(() => {
    const maxNumber = gameType === '75-ball' || gameType === 'party' ? 75 : 90;
    const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
    
    // Filter out numbers that have already been called
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);

  // Subscribe to number updates from the service
  useEffect(() => {
    if (!sessionId) return;
    
    const service = getNumberCallingService(sessionId);
    
    // Initialize with current state
    setCalledNumbers(service.getCalledNumbers());
    setLastCalledNumber(service.getLastCalledNumber());
    
    // Subscribe to updates
    const unsubscribe = service.subscribe((numbers, last) => {
      setCalledNumbers(numbers);
      setLastCalledNumber(last);
    });
    
    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  // Call a new number - this generates a random number from the remaining ones
  const callNextNumber = useCallback(async () => {
    if (!sessionId || isCallInProgress) return;
    
    try {
      setIsCallInProgress(true);
      
      const remaining = remainingNumbers();
      if (remaining.length === 0) {
        logWithTimestamp('No more numbers to call', 'info');
        return;
      }
      
      // Pick a random number from the remaining ones
      const index = Math.floor(Math.random() * remaining.length);
      const number = remaining[index];
      
      logWithTimestamp(`Calling number ${number}`, 'info');
      
      // Use service to call the number
      const success = await getNumberCallingService(sessionId).callNumber(number);
      
      return success ? number : null;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return null;
    } finally {
      setIsCallInProgress(false);
    }
  }, [sessionId, isCallInProgress, remainingNumbers]);

  // Reset all called numbers
  const resetCalledNumbers = useCallback(async () => {
    if (!sessionId) return false;
    
    try {
      return await getNumberCallingService(sessionId).resetNumbers();
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }, [sessionId]);

  return {
    calledNumbers,
    lastCalledNumber,
    isCallInProgress,
    remainingNumbers: remainingNumbers(),
    callNextNumber,
    resetCalledNumbers
  };
}
