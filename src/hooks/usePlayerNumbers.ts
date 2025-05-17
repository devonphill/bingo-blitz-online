import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { numberCallingService } from '@/services/number-calling';

/**
 * Hook for players to subscribe to number calls
 * This is the primary implementation for number subscription
 */
export function usePlayerNumbers(sessionId: string | null | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const unsubscribeRef = useRef<() => void>(() => {});
  const sessionIdRef = useRef<string | null | undefined>(sessionId);

  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Clean up function to remove subscription
  const cleanup = useCallback(() => {
    try {
      logWithTimestamp('Unsubscribing from number updates', 'info');
      unsubscribeRef.current();
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error unsubscribing from number updates:', error);
    }
  }, []);

  // Subscribe to number updates when session ID changes
  useEffect(() => {
    if (!sessionId) return;

    logWithTimestamp(`Subscribing to number updates for session: ${sessionId}`, 'info');

    try {
      // Clean up existing subscription if any
      cleanup();

      // Subscribe to the number calling service
      const unsubscribe = numberCallingService.subscribe(sessionId, (number, numbers) => {
        logWithTimestamp('Received number update', 'info');

        if (number === null) {
          // Handle reset
          setCalledNumbers([]);
          setLastCalledNumber(null);
        } else if (numbers && Array.isArray(numbers)) {
          setCalledNumbers(numbers);
          setLastCalledNumber(number);
        }

        // Set subscribed status
        setIsSubscribed(true);
      });

      // Store unsubscribe function
      unsubscribeRef.current = unsubscribe;

      // If the service has existing numbers for this session, use them
      if (numberCallingService.getCalledNumbers && typeof numberCallingService.getCalledNumbers === 'function') {
        const existingNumbers = numberCallingService.getCalledNumbers();
        if (existingNumbers && existingNumbers.length > 0) {
          setCalledNumbers(existingNumbers);
          setLastCalledNumber(existingNumbers[existingNumbers.length - 1]);
        }
      }

      return cleanup;
    } catch (error) {
      console.error('Error setting up number subscription:', error);
      return cleanup;
    }
  }, [sessionId, cleanup]);

  // Function to manually refresh numbers
  const refreshNumbers = useCallback(() => {
    if (!sessionIdRef.current) return;

    logWithTimestamp('Manually refreshing called numbers', 'info');

    // If the service has a method to get called numbers, use it
    if (numberCallingService.getCalledNumbers && typeof numberCallingService.getCalledNumbers === 'function') {
      const numbers = numberCallingService.getCalledNumbers();
      setCalledNumbers(numbers);

      if (numbers.length > 0) {
        setLastCalledNumber(numbers[numbers.length - 1]);
      }
    }
  }, []);

  return {
    calledNumbers,
    lastCalledNumber,
    isSubscribed,
    refreshNumbers
  };
}
