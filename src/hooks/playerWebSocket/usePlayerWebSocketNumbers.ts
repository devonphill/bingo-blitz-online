import { useState, useEffect, useRef, useCallback } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES } from '@/services/websocket';
import { fetchExistingNumbers } from './databaseUtils';
import { saveNumbersToLocalStorage, getNumbersFromLocalStorage } from './storageUtils';
import { setupNumberUpdateListeners } from './webSocketManager';
import { WebSocketNumbersState } from './types';

/**
 * Hook for managing WebSocket-based number updates with improved reliability
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined): WebSocketNumbersState {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const instanceId = useRef(`numUpdate-${Math.random().toString(36).substring(2, 7)}`);
  
  const channelRef = useRef<any>(null);
  const listenerCleanupRef = useRef<() => void>(() => {});
  
  // Log session ID updates
  useEffect(() => {
    logWithTimestamp(`[${instanceId.current}] Session ID updated to: ${sessionId}`, 'info');
  }, [sessionId]);
  
  useEffect(() => {
    logWithTimestamp(`[${instanceId.current}] Number updates hook initialized`, 'info');
    return () => {
      logWithTimestamp(`[${instanceId.current}] Number updates hook unmounted`, 'info');
    };
  }, []);
  
  // Function to save numbers to local storage
  const saveNumbersToLocalStorageCallback = useCallback((numbers: number[], lastNumber: number | null) => {
    saveNumbersToLocalStorage(sessionId, numbers, lastNumber);
  }, [sessionId]);

  // Function to check local storage
  const checkLocalStorage = useCallback(() => {
    if (!sessionId) return;
    
    try {
      const storedData = getNumbersFromLocalStorage(sessionId);
      
      if (storedData) {
        const storedNumbers = storedData.calledNumbers || [];
        const storedLastNumber = storedData.lastCalledNumber;
        
        // Only update if we have more numbers than current state or if we're not connected
        if ((storedNumbers.length > calledNumbers.length) || !isConnected) {
          logWithTimestamp(`[${instanceId.current}] Updating from localStorage: ${storedNumbers.length} numbers`, 'info');
          setCalledNumbers([...storedNumbers]);
          setLastCalledNumber(storedLastNumber);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, [sessionId, calledNumbers.length, isConnected]);

  // Setup WebSocket connection and channels when session changes
  useEffect(() => {
    if (!sessionId) {
      setCalledNumbers([]);
      setLastCalledNumber(null);
      setIsConnected(false);
      
      // Clean up any existing listeners
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = () => {};
      }
      
      return;
    }
    
    logWithTimestamp(`[${instanceId.current}] Creating number updates channel for session ${sessionId}`, 'info');
    
    // First load existing numbers from database
    fetchExistingNumbers(sessionId).then(numbers => {
      setCalledNumbers(numbers);
      
      // Set the last called number if available
      if (numbers.length > 0) {
        setLastCalledNumber(numbers[numbers.length - 1]);
      }
      
      saveNumbersToLocalStorage(sessionId, numbers, 
        numbers.length > 0 ? numbers[numbers.length - 1] : null);
      
      // Check localStorage as a backup
      checkLocalStorage();
    });
    
    // Create and configure the game updates channel
    if (!channelRef.current) {
      channelRef.current = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      // Set up connection status tracking
      webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
        setIsConnected(status === 'SUBSCRIBED');
        logWithTimestamp(`[${instanceId.current}] Number updates channel status: ${status}`, 'info');
      });
    }
    
    // Clean up any existing listeners
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
    }
    
    // Setup event listeners
    const cleanup = setupNumberUpdateListeners(
      sessionId,
      // Number update handler
      (number, _) => {
        logWithTimestamp(`[${instanceId.current}] Received number update: ${number}`, 'info');
      
        // Update state
        setLastCalledNumber(number);
        setLastUpdateTime(Date.now());
        
        setCalledNumbers(prev => {
          const updatedNumbers = prev.includes(number) ? [...prev] : [...prev, number];
          
          // Save to localStorage as backup
          saveNumbersToLocalStorageCallback(updatedNumbers, number);
          
          return updatedNumbers;
        });
      },
      // Reset handler
      () => {
        logWithTimestamp(`[${instanceId.current}] Received game reset event`, 'info');
        
        // Reset state
        setCalledNumbers([]);
        setLastCalledNumber(null);
        saveNumbersToLocalStorageCallback([], null);
      },
      instanceId.current
    );
    
    // Store cleanup function
    listenerCleanupRef.current = cleanup;
    
    // Poll localStorage for updates as a fallback (every 10 seconds)
    const storagePoller = setInterval(checkLocalStorage, 10000);
    
    // Cleanup function
    return () => {
      clearInterval(storagePoller);
      
      // We keep the channel alive for potential reuse, but clean up our listeners
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = () => {};
      }
      
      logWithTimestamp(`[${instanceId.current}] Cleaning up number updates for session ${sessionId}`, 'info');
    };
  }, [sessionId, checkLocalStorage, saveNumbersToLocalStorageCallback]);

  // Reconnect function - uses WebSocketService to force a channel reconnection
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Manual reconnection requested for session ${sessionId}`, 'info');
    
    // Force channel reconnection through service
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Fetch latest data
    fetchExistingNumbers(sessionId).then(numbers => {
      setCalledNumbers(numbers);
      
      // Set the last called number if available
      if (numbers.length > 0) {
        setLastCalledNumber(numbers[numbers.length - 1]);
      }
      
      // Check localStorage as backup
      checkLocalStorage();
    });
  }, [sessionId, checkLocalStorage]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    lastUpdateTime,
    reconnect
  };
}
