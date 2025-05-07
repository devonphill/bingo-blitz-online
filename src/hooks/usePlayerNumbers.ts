
import { useState, useEffect } from 'react';
import { getNumberCallingService } from '@/services/NumberCallingService';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for players to receive called numbers
 * Optimized for fast updates and reliability
 */
export function usePlayerNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to number updates from the service
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
      setCalledNumbers(service.getCalledNumbers());
      setLastCalledNumber(service.getLastCalledNumber());
      
      // Subscribe to updates
      const unsubscribe = service.subscribe((numbers, last) => {
        logWithTimestamp(`Received number update: ${numbers.length} numbers, last: ${last}`, 'info');
        setCalledNumbers([...numbers]);
        setLastCalledNumber(last);
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
    isConnected
  };
}
