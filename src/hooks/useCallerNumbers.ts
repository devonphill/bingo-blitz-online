
import { useState, useEffect, useCallback } from 'react';
import { getNumberCallingService } from '@/services/NumberCallingService';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/WebSocketService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for managing called numbers from the caller's perspective
 * Enhanced with better WebSocket broadcasting
 */
export function useCallerNumbers(sessionId: string | undefined, gameType: string = 'mainstage') {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [saveToDatabase, setSaveToDatabase] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

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
    
    // Setup WebSocket connection for the caller
    const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Subscribe with connection monitoring
    webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });
    
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
      // We don't remove the channel here since the WebSocketService
      // manages channel lifecycle globally
    };
  }, [sessionId, calledNumbers.length, lastCalledNumber]);

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
      
      // STEP 1: Broadcast the new number immediately via WebSocket
      // This is critical for real-time updates - do this FIRST
      const broadcastSuccess = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId,
          timestamp: Date.now(),
        }
      );
      
      if (!broadcastSuccess) {
        logWithTimestamp(`Warning: Failed to broadcast number ${number} via WebSocket`, 'warn');
        // We continue anyway since we'll also update the database
      }
      
      // STEP 2: Use service to call the number and update database
      const success = await getNumberCallingService(sessionId).callNumber(number);
      
      if (!success && saveToDatabase) {
        // If the service fails, attempt a direct database update as backup
        try {
          logWithTimestamp(`Attempting direct database update for number ${number}`, 'info');
          
          // First get current numbers
          const { data: currentData } = await supabase
            .from('sessions_progress')
            .select('called_numbers')
            .eq('session_id', sessionId)
            .single();
            
          // Update with the new number
          if (currentData) {
            const updatedNumbers = [...(currentData.called_numbers || []), number];
            
            const { error } = await supabase
              .from('sessions_progress')
              .update({
                called_numbers: updatedNumbers,
                updated_at: new Date().toISOString()
              })
              .eq('session_id', sessionId);
              
            if (error) {
              throw new Error(`Database update error: ${error.message}`);
            }
          }
        } catch (dbError) {
          logWithTimestamp(`Failed direct database update: ${dbError}`, 'error');
          // Allow UI update anyway since we broadcasted successfully
        }
      }
      
      // STEP 3: Update local state immediately for UI responsiveness
      // We do this regardless of database success since we already broadcasted
      setCalledNumbers(prev => [...prev, number]);
      setLastCalledNumber(number);
      setLastUpdateTime(Date.now());
      
      return number;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return null;
    } finally {
      setIsCallInProgress(false);
    }
  }, [sessionId, isCallInProgress, remainingNumbers, saveToDatabase]);

  // Reset all called numbers
  const resetCalledNumbers = useCallback(async () => {
    if (!sessionId) return false;
    
    try {
      // First broadcast the reset
      const broadcastSuccess = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.GAME_RESET,
        {
          sessionId,
          timestamp: Date.now(),
        }
      );
      
      if (!broadcastSuccess) {
        logWithTimestamp('Warning: Failed to broadcast game reset via WebSocket', 'warn');
      }
      
      // Then reset via service
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
  
  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp('Manually reconnecting caller WebSocket', 'info');
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Also refresh from service
    const service = getNumberCallingService(sessionId);
    const numbers = service.getCalledNumbers();
    const lastNumber = service.getLastCalledNumber();
    
    setCalledNumbers([...numbers]);
    setLastCalledNumber(lastNumber);
    setLastUpdateTime(Date.now());
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
    toggleSaveToDatabase,
    isConnected,
    reconnect
  };
}
