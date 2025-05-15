
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

export function usePlayerWebSocketNumbers(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [numberCallTimestamp, setNumberCallTimestamp] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const instanceId = useRef(`numUpdate-${Math.random().toString(36).substring(2, 7)}`);
  
  // Use SingleSourceTrueConnections instead of direct WebSocket access
  const singleSource = useRef(getSingleSourceConnection());

  // Setup listener for number called events
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Setting up number called listener for session ${sessionId}`, 'info');
    
    // Set up connection listener
    const connectionRemover = singleSource.current.addConnectionListener((connected) => {
      setIsConnected(connected);
    });
    
    // Set up number called listener
    const numberCalledRemover = singleSource.current.onNumberCalled((number, numbers) => {
      logWithTimestamp(`[${instanceId.current}] Number called: ${number}`, 'info');
      
      if (number !== null) {
        setCurrentNumber(number);
        setNumberCallTimestamp(Date.now());
        setCalledNumbers(numbers);
      }
    });
    
    // Fetch existing called numbers
    fetchExistingNumbers(sessionId);
    
    // Connect to session
    singleSource.current.connect(sessionId);
    
    // Initial connection state
    setIsConnected(singleSource.current.isConnected());
    
    return () => {
      // Clean up listeners
      connectionRemover();
      numberCalledRemover();
    };
  }, [sessionId]);

  // Fetch existing called numbers from the database
  const fetchExistingNumbers = useCallback(async (sessionId: string) => {
    try {
      logWithTimestamp(`[${instanceId.current}] Fetching existing called numbers for session ${sessionId}`, 'info');
      
      // Query called_numbers from sessions_progress table
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch called numbers: ${error.message}`);
      }
      
      if (data && data.called_numbers && data.called_numbers.length > 0) {
        const numbers = data.called_numbers;
        const lastNumber = numbers[numbers.length - 1];
        const lastTimestamp = new Date(data.updated_at).getTime();
        
        setCalledNumbers(numbers);
        setCurrentNumber(lastNumber);
        setNumberCallTimestamp(lastTimestamp);
        logWithTimestamp(`[${instanceId.current}] Loaded ${numbers.length} existing called numbers, last number: ${lastNumber}`, 'info');
      }
    } catch (error) {
      logWithTimestamp(`[${instanceId.current}] Error fetching existing numbers: ${error}`, 'error');
    }
  }, []);
  
  // Function to reconnect with SingleSourceTrueConnections
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[${instanceId.current}] Manual reconnection requested`, 'info');
    
    // Reconnect using SingleSourceTrueConnections
    singleSource.current.reconnect();
    
    // Set isConnected to false during reconnection attempt
    setIsConnected(false);
    
    // Fetch fresh data
    fetchExistingNumbers(sessionId);
  }, [sessionId, fetchExistingNumbers]);

  return {
    calledNumbers,
    currentNumber,
    numberCallTimestamp,
    isConnected,
    reconnect
  };
}
