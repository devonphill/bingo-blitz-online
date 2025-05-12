
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Consistent channel name used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';

export function useNumberUpdates(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [numberCallTimestamp, setNumberCallTimestamp] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  
  // Track component mount state
  const isMountedRef = useRef(true);

  // Connect to the real-time channel with improved channel management
  useEffect(() => {
    // Set initial mounted state
    isMountedRef.current = true;
    
    // Function to safely create and set up the channel
    const setupChannel = () => {
      if (!sessionId) {
        logWithTimestamp('No session ID for number updates', 'warn');
        return null;
      }
      
      if (channelRef.current) {
        logWithTimestamp('Number updates channel already exists, reusing', 'info');
        return channelRef.current;
      }
      
      logWithTimestamp(`Setting up number updates channel for session ${sessionId}`, 'info');
      
      // Create channel with proper configuration
      const channel = supabase
        .channel(GAME_UPDATES_CHANNEL, {
          config: {
            broadcast: { 
              self: true, // Receive own broadcasts
              ack: true   // Request acknowledgment
            }
          }
        })
        .on('broadcast', { event: 'number-called' }, payload => {
          if (!isMountedRef.current) return; // Safety check
          
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
          if (!isMountedRef.current) return; // Safety check
          
          logWithTimestamp(`Number updates channel status: ${status}`, 'info');
          setIsConnected(status === 'SUBSCRIBED');
        });
      
      return channel;
    };
    
    // First get all existing called numbers - separated from channel creation
    const fetchExistingNumbers = async () => {
      if (!sessionId) return;
      
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
          
          if (isMountedRef.current) {
            setCalledNumbers(numbers);
            setCurrentNumber(lastNumber);
            setNumberCallTimestamp(lastTimestamp);
            logWithTimestamp(`Loaded ${numbers.length} existing called numbers`, 'info');
          }
        }
      } catch (error) {
        logWithTimestamp(`Error fetching existing numbers: ${error}`, 'error');
      }
    };

    // Execute initialization
    fetchExistingNumbers();
    
    // Set up channel after a small delay to avoid race conditions
    const channelTimer = setTimeout(() => {
      if (isMountedRef.current) {
        // Store channel reference for cleanup
        channelRef.current = setupChannel();
      }
    }, 100);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      
      clearTimeout(channelTimer);
      
      if (channelRef.current) {
        logWithTimestamp('Cleaning up number updates channel', 'info');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId]);
  
  // Function to reconnect with exponential backoff
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    logWithTimestamp('Attempting to reconnect number updates', 'info');
    
    // Clean up existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Set isConnected to false to indicate reconnection attempt
    setIsConnected(false);
    
    // Create a new channel with a slight delay
    setTimeout(() => {
      if (isMountedRef.current && !channelRef.current) {
        channelRef.current = supabase
          .channel(GAME_UPDATES_CHANNEL, {
            config: {
              broadcast: { self: true, ack: true }
            }
          })
          .on('broadcast', { event: 'number-called' }, payload => {
            if (!isMountedRef.current) return;
            
            if (payload && payload.payload) {
              const { number, timestamp, sessionId: payloadSessionId } = payload.payload;
              
              if (payloadSessionId === sessionId) {
                logWithTimestamp(`Real-time number update after reconnect: ${number}`, 'info');
                setCurrentNumber(number);
                setNumberCallTimestamp(timestamp);
                
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
            if (!isMountedRef.current) return;
            
            logWithTimestamp(`Number updates channel status after reconnect: ${status}`, 'info');
            setIsConnected(status === 'SUBSCRIBED');
          });
          
        logWithTimestamp('Number updates reconnection attempt complete', 'info');
      }
    }, 500);
  }, [sessionId]);

  return {
    calledNumbers,
    currentNumber,
    numberCallTimestamp,
    isConnected,
    reconnect
  };
}
