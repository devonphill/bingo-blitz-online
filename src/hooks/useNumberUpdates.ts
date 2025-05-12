
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useNumberUpdates(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [numberCallTimestamp, setNumberCallTimestamp] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Connect to the real-time channel
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('No session ID for number updates', 'warn');
      return;
    }
    
    logWithTimestamp(`Setting up number updates for session ${sessionId}`, 'info');
    
    // First get all existing called numbers
    async function fetchExistingNumbers() {
      try {
        const { data, error } = await supabase
          .from('called_numbers')
          .select('number, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        
        if (error) {
          throw new Error(`Failed to fetch called numbers: ${error.message}`);
        }
        
        if (data && data.length > 0) {
          const numbers = data.map(item => item.number);
          const lastNumber = data[data.length - 1].number;
          const lastTimestamp = new Date(data[data.length - 1].created_at).getTime();
          
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
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`number-updates-${sessionId}`)
      .on('broadcast', { event: 'number-called' }, payload => {
        const { number, timestamp } = payload.payload;
        
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
        
        setIsConnected(true);
      })
      .subscribe((status) => {
        logWithTimestamp(`Number updates channel status: ${status}`, 'info');
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      logWithTimestamp('Cleaning up number updates channel', 'info');
      supabase.removeChannel(channel);
    };
  }, [sessionId]);
  
  // Function to reconnect
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp('Attempting to reconnect number updates', 'info');
    
    // This will trigger the useEffect to run again
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
