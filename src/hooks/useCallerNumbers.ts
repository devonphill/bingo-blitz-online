
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { numberCallingService } from '@/services/number-calling';
import { getSingleSourceConnection } from '@/utils/connectionManager';

/**
 * Hook for managing called numbers as a caller
 */
export function useCallerNumbers(sessionId: string | undefined, autoConnect: boolean = true) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize the connection
  useEffect(() => {
    if (!sessionId || !autoConnect) return;
    
    // Initialize connection
    const initializeConnection = async () => {
      try {
        logWithTimestamp(`Initializing Caller Number connection for session: ${sessionId}`, 'info');
        
        // Subscribe to number updates
        const unsubscribe = numberCallingService.subscribe(sessionId, (number, numbers) => {
          setLastCalledNumber(number);
          setCalledNumbers(numbers);
        });
        
        // Mark as initialized
        setIsInitialized(true);
        
        // Clean up on unmount
        return () => {
          logWithTimestamp(`Cleaning up Caller Number connection for session: ${sessionId}`, 'info');
          unsubscribe();
        };
      } catch (e) {
        logWithTimestamp(`Error initializing Caller Number connection: ${e}`, 'error');
        setError('Failed to initialize number calling service');
      }
    };
    
    initializeConnection();
    
    // Clean up on unmount
    return () => {
      setIsInitialized(false);
    };
  }, [sessionId, autoConnect]);
  
  // Method to call a number
  const callNumber = useCallback(async (number: number) => {
    if (!sessionId) {
      setError('No session ID provided');
      return false;
    }
    
    setIsBroadcasting(true);
    setError(null);
    
    try {
      logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
      
      // Get the connection instance and call the number
      const connection = getSingleSourceConnection();
      const success = await connection.callNumber(number, sessionId);
      
      if (success) {
        // Get the current called numbers to pass to the notifyListeners method
        const currentCalledNumbers = [...calledNumbers, number];
        
        // Notify our service of the new number, passing all required arguments
        numberCallingService.notifyListeners(sessionId, number, currentCalledNumbers);
        
        toast({
          title: "Number Called",
          description: `Successfully called number ${number}`,
        });
        
        return true;
      } else {
        setError('Failed to call number');
        return false;
      }
    } catch (e) {
      logWithTimestamp(`Error calling number: ${e}`, 'error');
      setError('Failed to call number');
      return false;
    } finally {
      setIsBroadcasting(false);
    }
  }, [sessionId, calledNumbers]);
  
  // Method to reset numbers
  const resetNumbers = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      return false;
    }
    
    setIsResetting(true);
    setError(null);
    
    try {
      logWithTimestamp(`Resetting numbers for session ${sessionId}`, 'info');
      
      // Reset numbers in the service
      const success = await numberCallingService.resetNumbers(sessionId);
      
      if (success) {
        toast({
          title: "Numbers Reset",
          description: "Successfully reset the called numbers",
        });
        
        return true;
      } else {
        setError('Failed to reset numbers');
        return false;
      }
    } catch (e) {
      logWithTimestamp(`Error resetting numbers: ${e}`, 'error');
      setError('Failed to reset numbers');
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [sessionId]);
  
  // Method to update called numbers
  const updateCalledNumbers = useCallback(async (numbers: number[]) => {
    if (!sessionId) {
      setError('No session ID provided');
      return false;
    }
    
    setError(null);
    
    try {
      logWithTimestamp(`Updating called numbers for session ${sessionId}`, 'info');
      
      // Update numbers in the service
      const success = await numberCallingService.updateCalledNumbers(sessionId, numbers);
      
      if (success) {
        toast({
          title: "Numbers Updated",
          description: "Successfully updated the called numbers",
        });
        
        return true;
      } else {
        setError('Failed to update called numbers');
        return false;
      }
    } catch (e) {
      logWithTimestamp(`Error updating called numbers: ${e}`, 'error');
      setError('Failed to update called numbers');
      return false;
    }
  }, [sessionId]);
  
  // Reconnect method
  const reconnect = useCallback(() => {
    if (!sessionId) {
      setError('No session ID provided');
      return;
    }
    
    setIsReconnecting(true);
    setError(null);
    
    try {
      logWithTimestamp(`Reconnecting Caller Number connection for session: ${sessionId}`, 'info');
      
      // Get the connection instance and call reconnect
      const connection = getSingleSourceConnection();
      connection.reconnect();
      
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the session",
      });
    } catch (e) {
      logWithTimestamp(`Error reconnecting: ${e}`, 'error');
      setError('Failed to reconnect');
    } finally {
      setIsReconnecting(false);
    }
  }, [sessionId]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    isBroadcasting,
    isResetting,
    isInitialized,
    isReconnecting,
    error,
    callNumber,
    resetNumbers,
    updateCalledNumbers,
    reconnect
  };
}
