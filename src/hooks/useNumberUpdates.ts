
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useNumberUpdates(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [numberCallTimestamp, setNumberCallTimestamp] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  // Connect to the real-time channel
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('No session ID for number updates', 'warn');
      return;
    }
    
    // Clean up existing channel if it exists
    if (channelRef.current) {
      logWithTimestamp(`Cleaning up existing number updates channel before creating a new one`, 'info');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    logWithTimestamp(`Setting up number updates for session ${sessionId}`, 'info');
    
    // First get all existing called numbers
    async function fetchExistingNumbers() {
      try {
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
          logWithTimestamp(`Loaded ${numbers.length} existing called numbers`, 'info');
        }
      } catch (error) {
        logWithTimestamp(`Error fetching existing numbers: ${error}`, 'error');
      }
    }
    
    fetchExistingNumbers();
    
    // Subscribe to real-time updates using consistent channel name
    const channel = supabase
      .channel('game-updates')
      .on('broadcast', { event: 'number-called' }, payload => {
        if (payload && payload.payload) {
          const { number, timestamp, sessionId: payloadSessionId } = payload.payload;
          
          // Only process updates for our session
          if (payloadSessionId === sessionId) {
            logWithTimestamp(`Real-time number update: ${number}`, 'info');
            setCurrentNumber(number);
            setNumberCallTimestamp(timestamp);
            
            // Add to called numbers list if not already there
            setCalledNumbers(prev => {
              if (!prev.includes(number)) {
                return [...prev, number];
              }
              return prev;
            });
          }
        }
        
        setIsConnected(true);
      })
      .subscribe((status) => {
        logWithTimestamp(`Number updates channel status: ${status}`, 'info');
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    // Store channel reference for cleanup
    channelRef.current = channel;
    
    return () => {
      if (channelRef.current) {
        logWithTimestamp('Cleaning up number updates channel', 'info');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId]);
  
  // Function to reconnect
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp('Attempting to reconnect number updates', 'info');
    
    // Clean up existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Set isConnected to false to trigger the useEffect to run again
    setIsConnected(false);
  }, [sessionId]);

  return {
    calledNumbers,
    currentNumber,
    numberCallTimestamp,
    isConnected,
    reconnect
  };
}
