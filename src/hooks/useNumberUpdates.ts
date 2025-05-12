
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define consistent channel name used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const NUMBER_CALLED_EVENT = 'number-called';

export function useNumberUpdates(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [numberCallTimestamp, setNumberCallTimestamp] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  
  // Track component mount state and session ID consistently
  const isMountedRef = useRef(true);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const instanceId = useRef(`numUpdate-${Math.random().toString(36).substring(2, 7)}`);

  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
    logWithTimestamp(`[${instanceId.current}] Session ID updated to: ${sessionId}`, 'info');
  }, [sessionId]);

  // Setup function to create a channel with proper configuration and event handling
  const createChannel = useCallback(() => {
    if (!sessionIdRef.current) {
      logWithTimestamp(`[${instanceId.current}] Cannot create channel: No session ID`, 'warn');
      return null;
    }
    
    logWithTimestamp(`[${instanceId.current}] Creating number updates channel for session ${sessionIdRef.current}`, 'info');
    
    try {
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
        .on('broadcast', { event: NUMBER_CALLED_EVENT }, payload => {
          if (!isMountedRef.current) return; // Safety check
          
          if (payload && payload.payload) {
            const { number, timestamp, sessionId: payloadSessionId } = payload.payload;
            
            // Only process updates for our session
            if (payloadSessionId === sessionIdRef.current) {
              logWithTimestamp(`[${instanceId.current}] Real-time number update: ${number}`, 'info');
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
        })
        .subscribe((status) => {
          if (!isMountedRef.current) return; // Safety check
          
          logWithTimestamp(`[${instanceId.current}] Number updates channel status: ${status}`, 'info');
          setIsConnected(status === 'SUBSCRIBED');
        });
      
      return channel;
    } catch (err) {
      logWithTimestamp(`[${instanceId.current}] Error setting up number updates channel: ${err}`, 'error');
      return null;
    }
  }, []);

  // Fetch existing called numbers from the database
  const fetchExistingNumbers = useCallback(async () => {
    if (!sessionIdRef.current) {
      logWithTimestamp(`[${instanceId.current}] Cannot fetch numbers: No session ID`, 'warn');
      return;
    }
    
    try {
      logWithTimestamp(`[${instanceId.current}] Fetching existing called numbers for session ${sessionIdRef.current}`, 'info');
      
      // Query called_numbers from sessions_progress table
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', sessionIdRef.current)
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
          logWithTimestamp(`[${instanceId.current}] Loaded ${numbers.length} existing called numbers, last number: ${lastNumber}`, 'info');
        }
      }
    } catch (error) {
      logWithTimestamp(`[${instanceId.current}] Error fetching existing numbers: ${error}`, 'error');
    }
  }, []);

  // Connect to the real-time channel with improved channel management
  useEffect(() => {
    // Set initial mounted state
    isMountedRef.current = true;
    logWithTimestamp(`[${instanceId.current}] Number updates hook initialized`, 'info');
    
    // Initial fetch with a small delay to ensure session ID is available
    const fetchTimer = setTimeout(() => {
      if (sessionIdRef.current) {
        fetchExistingNumbers();
      }
    }, 300);
    
    // Setup channel with a slightly longer delay
    const setupTimer = setTimeout(() => {
      if (isMountedRef.current && sessionIdRef.current) {
        // Clean up existing channel if any
        if (channelRef.current) {
          try {
            logWithTimestamp(`[${instanceId.current}] Removing existing channel before creating new one`, 'info');
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          } catch (err) {
            logWithTimestamp(`[${instanceId.current}] Error removing existing channel: ${err}`, 'error');
          }
        }
        
        // Create a new channel
        channelRef.current = createChannel();
      }
    }, 500);
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      logWithTimestamp(`[${instanceId.current}] Number updates hook cleanup`, 'info');
      
      clearTimeout(fetchTimer);
      clearTimeout(setupTimer);
      
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error('Error removing channel during cleanup:', err);
        }
      }
    };
  }, [fetchExistingNumbers, createChannel]);
  
  // Separate effect to handle sessionId changes
  useEffect(() => {
    if (!sessionId || sessionId === sessionIdRef.current) return;
    
    logWithTimestamp(`[${instanceId.current}] Session ID changed to ${sessionId}, reconnecting`, 'info');
    
    // Clean up existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } catch (err) {
        console.error('Error removing channel on sessionId change:', err);
      }
    }
    
    // Fetch existing numbers with a delay to ensure the session ID change has propagated
    setTimeout(() => {
      if (sessionId && isMountedRef.current) {
        fetchExistingNumbers();
        
        // Create new channel with another small delay
        setTimeout(() => {
          if (isMountedRef.current && sessionId) {
            channelRef.current = createChannel();
          }
        }, 200);
      }
    }, 300);
  }, [sessionId, fetchExistingNumbers, createChannel]);
  
  // Function to reconnect with exponential backoff
  const reconnect = useCallback(() => {
    if (!sessionIdRef.current) return;
    
    logWithTimestamp(`[${instanceId.current}] Manual reconnection requested`, 'info');
    
    // Clean up existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } catch (err) {
        console.error('Error removing channel during reconnect:', err);
      }
    }
    
    // Set isConnected to false during reconnection attempt
    setIsConnected(false);
    
    // Fetch fresh data first
    fetchExistingNumbers();
    
    // Create a new channel with a slight delay
    setTimeout(() => {
      if (isMountedRef.current && sessionIdRef.current) {
        channelRef.current = createChannel();
      }
    }, 300);
  }, [fetchExistingNumbers, createChannel]);

  return {
    calledNumbers,
    currentNumber,
    numberCallTimestamp,
    isConnected,
    reconnect
  };
}
