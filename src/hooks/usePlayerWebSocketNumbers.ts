import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/WebSocketService';

/**
 * Hook for managing WebSocket-based number updates with improved reliability
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined) {
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
  
  // Function to fetch existing called numbers
  const fetchExistingNumbers = useCallback(async () => {
    if (!sessionId) return [];
    
    try {
      logWithTimestamp(`[${instanceId.current}] Fetching existing called numbers for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`[${instanceId.current}] Error fetching called numbers: ${error.message}`, 'error');
        return [];
      }
      
      const numbers = data?.called_numbers || [];
      
      // Set the last called number if available
      if (numbers.length > 0) {
        setLastCalledNumber(numbers[numbers.length - 1]);
        logWithTimestamp(`[${instanceId.current}] Loaded ${numbers.length} existing called numbers, last number: ${numbers[numbers.length - 1]}`, 'info');
      }
      
      return numbers;
    } catch (err) {
      logWithTimestamp(`[${instanceId.current}] Exception fetching called numbers: ${err}`, 'error');
      return [];
    }
  }, [sessionId]);

  const saveNumbersToLocalStorage = useCallback((numbers: number[], lastNumber: number | null) => {
    if (!sessionId) return;
    
    try {
      const storageKey = `bingo-numbers-session-${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId,
        calledNumbers: numbers,
        lastCalledNumber: lastNumber,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }, [sessionId]);

  const checkLocalStorage = useCallback(() => {
    if (!sessionId) return;
    
    try {
      const storageKey = `bingo-numbers-session-${sessionId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsedData = JSON.parse(stored);
        const storedNumbers = parsedData.calledNumbers || [];
        const storedLastNumber = parsedData.lastCalledNumber;
        
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
    fetchExistingNumbers().then(numbers => {
      setCalledNumbers(numbers);
      saveNumbersToLocalStorage(numbers, numbers.length > 0 ? numbers[numbers.length - 1] : null);
      
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
    
    // Add event handler for number updates
    const numberHandler = (payload: any) => {
      if (!payload || !payload.payload) return;
      
      const { number, sessionId: payloadSessionId } = payload.payload;
      
      // Ensure this event is for our session
      if (payloadSessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId.current}] Received number update: ${number} for session ${payloadSessionId}`, 'info');
      
      // Update state
      setLastCalledNumber(number);
      setLastUpdateTime(Date.now());
      
      setCalledNumbers(prev => {
        const updatedNumbers = prev.includes(number) ? [...prev] : [...prev, number];
        
        // Save to localStorage as backup
        saveNumbersToLocalStorage(updatedNumbers, number);
        
        return updatedNumbers;
      });
    };
    
    // Add handler for game reset events
    const resetHandler = (payload: any) => {
      if (!payload || !payload.payload) return;
      
      const { sessionId: payloadSessionId } = payload.payload;
      
      // Ensure this event is for our session
      if (payloadSessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId.current}] Received game reset for session ${payloadSessionId}`, 'info');
      
      // Reset state
      setCalledNumbers([]);
      setLastCalledNumber(null);
      saveNumbersToLocalStorage([], null);
    };
    
    // Add the listeners using WebSocketService
    const numberCleanup = webSocketService.addListener(
      CHANNEL_NAMES.GAME_UPDATES, 
      'broadcast', 
      EVENT_TYPES.NUMBER_CALLED, 
      numberHandler
    );
    
    const resetCleanup = webSocketService.addListener(
      CHANNEL_NAMES.GAME_UPDATES,
      'broadcast',
      EVENT_TYPES.GAME_RESET,
      resetHandler
    );
    
    // Store cleanup function
    listenerCleanupRef.current = () => {
      numberCleanup();
      resetCleanup();
    };
    
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
  }, [sessionId, fetchExistingNumbers, saveNumbersToLocalStorage, checkLocalStorage]);

  // Reconnect function - uses WebSocketService to force a channel reconnection
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Manual reconnection requested for session ${sessionId}`, 'info');
    
    // Force channel reconnection through service
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Fetch latest data
    fetchExistingNumbers().then(numbers => {
      setCalledNumbers(numbers);
      
      // Check localStorage as backup
      checkLocalStorage();
    });
  }, [sessionId, fetchExistingNumbers, checkLocalStorage]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    lastUpdateTime,
    reconnect
  };
}
