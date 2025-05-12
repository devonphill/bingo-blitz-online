
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
  const instanceId = useRef(`ws-${Math.random().toString(36).substring(2, 7)}`);
  
  // Track all the event handlers
  const numberEventHandlers = useRef<{[key: string]: any}>({});
  const isInitialized = useRef(false);
  
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
      return;
    }
    
    logWithTimestamp(`[${instanceId.current}] Setting up number updates for session ${sessionId}`, 'info');
    isInitialized.current = true;
    
    // First load existing numbers from database
    fetchExistingNumbers().then(numbers => {
      setCalledNumbers(numbers);
      saveNumbersToLocalStorage(numbers, numbers.length > 0 ? numbers[numbers.length - 1] : null);
      
      // Check localStorage as a backup
      checkLocalStorage();
    });
    
    // Create and configure the game updates channel
    const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    
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
    
    // Store the handler reference
    numberEventHandlers.current = { 
      [EVENT_TYPES.NUMBER_CALLED]: numberHandler 
    };
    
    // Add handler for number called events
    channel.on('broadcast', { event: EVENT_TYPES.NUMBER_CALLED }, numberHandler);
    
    // Handle game reset events
    channel.on('broadcast', { event: EVENT_TYPES.GAME_RESET }, (payload: any) => {
      if (!payload || !payload.payload) return;
      
      const { sessionId: payloadSessionId } = payload.payload;
      
      // Ensure this event is for our session
      if (payloadSessionId !== sessionId) return;
      
      logWithTimestamp(`[${instanceId.current}] Received game reset for session ${payloadSessionId}`, 'info');
      
      // Reset state
      setCalledNumbers([]);
      setLastCalledNumber(null);
      saveNumbersToLocalStorage([], null);
    });
    
    // Subscribe with connection monitoring
    webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });
    
    // Poll localStorage for updates as a fallback (every 10 seconds)
    const storagePoller = setInterval(checkLocalStorage, 10000);
    
    // Cleanup function
    return () => {
      clearInterval(storagePoller);
      
      if (isInitialized.current) {
        logWithTimestamp(`[${instanceId.current}] Cleaning up number updates`, 'info');
        isInitialized.current = false;
      }
      
      // We don't remove the channel here since the WebSocketService
      // manages channel lifecycle globally, which improves reconnection
    };
  }, [sessionId, fetchExistingNumbers, saveNumbersToLocalStorage, checkLocalStorage]);

  // Reconnect function - force creation of a new channel
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Manual reconnection requested`, 'info');
    
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
