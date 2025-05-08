
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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [saveToDatabase, setSaveToDatabase] = useState(true);

  // Calculate remaining numbers based on game type and called numbers
  const remainingNumbers = useCallback(() => {
    const maxNumber = gameType === '75-ball' || gameType === 'party' ? 75 : 90;
    const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
    
    // Filter out numbers that have already been called
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);

  // Subscribe to number updates from the service with improved stability
  useEffect(() => {
    if (!sessionId) return;
    
    const service = getNumberCallingService(sessionId);
    
    // Initialize with current state
    const initialNumbers = service.getCalledNumbers();
    const initialLastNumber = service.getLastCalledNumber();
    
    setCalledNumbers(initialNumbers);
    setLastCalledNumber(initialLastNumber);
    setLastUpdateTime(Date.now());
    setSaveToDatabase(service.getSaveToDatabase());
    
    // Subscribe to updates with enhanced stability
    const unsubscribe = service.subscribe((numbers, last) => {
      // Only update if there's an actual change
      const isActualUpdate = last !== lastCalledNumber || numbers.length !== calledNumbers.length;
      
      if (isActualUpdate) {
        logWithTimestamp(`Caller received update: ${numbers.length} numbers, last: ${last}`, 'info');
        setCalledNumbers([...numbers]);
        setLastCalledNumber(last);
        setLastUpdateTime(Date.now());
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  // Call a new number - this generates a random number from the remaining ones
  const callNextNumber = useCallback(async () => {
    if (!sessionId || isCallInProgress) return null;
    
    try {
      setIsCallInProgress(true);
      
      const remaining = remainingNumbers();
      if (remaining.length === 0) {
        logWithTimestamp('No more numbers to call', 'info');
        return null;
      }
      
      // Pick a random number from the remaining ones
      const index = Math.floor(Math.random() * remaining.length);
      const number = remaining[index];
      
      logWithTimestamp(`Calling number ${number}`, 'info');
      
      // Use service to call the number
      const success = await getNumberCallingService(sessionId).callNumber(number);
      
      if (success) {
        // Update local state immediately for UI responsiveness
        setCalledNumbers(prev => [...prev, number]);
        setLastCalledNumber(number);
        setLastUpdateTime(Date.now());
        return number;
      }
      
      return null;
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
      const success = await getNumberCallingService(sessionId).resetNumbers();
      
      if (success) {
        // Update local state immediately
        setCalledNumbers([]);
        setLastCalledNumber(null);
        setLastUpdateTime(Date.now());
      }
      
      return success;
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }, [sessionId]);

  // Toggle the save to database setting
  const toggleSaveToDatabase = useCallback(() => {
    if (!sessionId) return;
    
    const service = getNumberCallingService(sessionId);
    const currentValue = service.getSaveToDatabase();
    service.setSaveToDatabase(!currentValue);
    setSaveToDatabase(!currentValue);
    
    logWithTimestamp(`Save to database toggled to: ${!currentValue}`, 'info');
  }, [sessionId]);

  return {
    calledNumbers,
    lastCalledNumber,
    isCallInProgress,
    remainingNumbers: remainingNumbers(),
    callNextNumber,
    resetCalledNumbers,
    lastUpdateTime,
    saveToDatabase,
    toggleSaveToDatabase
  };
}
