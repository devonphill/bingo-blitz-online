
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
  const sessionIdRef = useRef<string | undefined>(sessionId);

  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Connect to the real-time channel with improved channel management
  useEffect(() => {
    // Set initial mounted state
    isMountedRef.current = true;
    
    // Function to safely set up the channel
    const setupChannel = () => {
      if (!sessionIdRef.current) {
        logWithTimestamp('No session ID for number updates', 'warn');
        return null;
      }
      
      // Clean up existing channel if any
      if (channelRef.current) {
        try {
          logWithTimestamp('Removing existing number updates channel before creating new one', 'info');
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          logWithTimestamp(`Error removing existing channel: ${err}`, 'error');
        }
      }
      
      logWithTimestamp(`Setting up number updates channel for session ${sessionIdRef.current}`, 'info');
      
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
          .on('broadcast', { event: 'number-called' }, payload => {
            if (!isMountedRef.current) return; // Safety check
            
            if (payload && payload.payload) {
              const { number, timestamp, sessionId: payloadSessionId } = payload.payload;
              
              // Only process updates for our session
              if (payloadSessionId === sessionIdRef.current) {
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
      } catch (err) {
        logWithTimestamp(`Error setting up number updates channel: ${err}`, 'error');
        return null;
      }
    };
    
    // First get all existing called numbers - separated from channel creation
    const fetchExistingNumbers = async () => {
      if (!sessionIdRef.current) return;
      
      try {
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
            logWithTimestamp(`Loaded ${numbers.length} existing called numbers`, 'info');
          }
        }
      } catch (error) {
        logWithTimestamp(`Error fetching existing numbers: ${error}`, 'error');
      }
    };

    // Allow a short delay before fetching numbers to ensure sessionId is available
    const fetchTimer = setTimeout(() => {
      if (sessionIdRef.current) {
        fetchExistingNumbers();
      }
    }, 100);
    
    // Set up channel after a small delay to avoid race conditions
    const channelTimer = setTimeout(() => {
      if (isMountedRef.current && sessionIdRef.current) {
        channelRef.current = setupChannel();
      }
    }, 300); // Slightly longer delay for channel setup
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
      
      clearTimeout(fetchTimer);
      clearTimeout(channelTimer);
      
      if (channelRef.current) {
        logWithTimestamp('Cleaning up number updates channel', 'info');
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.error('Error removing channel:', err);
        }
        channelRef.current = null;
      }
    };
  }, []);
  
  // Separate effect to handle sessionId changes
  useEffect(() => {
    // Only recreate channel if sessionId changes and we're already mounted
    if (sessionIdRef.current !== sessionId && isMountedRef.current) {
      logWithTimestamp(`Session ID changed from ${sessionIdRef.current} to ${sessionId}, reconnecting`, 'info');
      sessionIdRef.current = sessionId;
      
      // Clean up existing channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error('Error removing channel on sessionId change:', err);
        }
      }
      
      // Reconnect with a small delay
      setTimeout(() => {
        if (sessionId && isMountedRef.current) {
          // Fetch existing numbers again
          const fetchExistingNumbers = async () => {
            try {
              const { data, error } = await supabase
                .from('sessions_progress')
                .select('called_numbers, updated_at')
                .eq('session_id', sessionId)
                .single();
              
              if (error) throw error;
              
              if (data && data.called_numbers && isMountedRef.current) {
                setCalledNumbers(data.called_numbers);
                if (data.called_numbers.length > 0) {
                  setCurrentNumber(data.called_numbers[data.called_numbers.length - 1]);
                  setNumberCallTimestamp(new Date(data.updated_at).getTime());
                }
              }
            } catch (error) {
              logWithTimestamp(`Error re-fetching called numbers: ${error}`, 'error');
            }
          };
          
          fetchExistingNumbers();
          
          // Setup new channel
          channelRef.current = supabase
            .channel(GAME_UPDATES_CHANNEL, {
              config: {
                broadcast: { self: true, ack: true }
              }
            })
            .on('broadcast', { event: 'number-called' }, payload => {
              if (!isMountedRef.current) return;
              
              if (payload?.payload?.sessionId === sessionId) {
                const { number, timestamp } = payload.payload;
                setCurrentNumber(number);
                setNumberCallTimestamp(timestamp);
                setCalledNumbers(prev => {
                  if (!prev.includes(number)) return [...prev, number];
                  return prev;
                });
              }
            })
            .subscribe(status => {
              if (isMountedRef.current) {
                setIsConnected(status === 'SUBSCRIBED');
              }
            });
        }
      }, 200);
    }
  }, [sessionId]);
  
  // Function to reconnect with exponential backoff
  const reconnect = useCallback(() => {
    if (!sessionIdRef.current) return;
    
    logWithTimestamp('Attempting to reconnect number updates', 'info');
    
    // Clean up existing channel if it exists
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } catch (err) {
        console.error('Error removing channel during reconnect:', err);
      }
    }
    
    // Set isConnected to false to indicate reconnection attempt
    setIsConnected(false);
    
    // Create a new channel with a slight delay
    setTimeout(() => {
      if (isMountedRef.current && !channelRef.current && sessionIdRef.current) {
        try {
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
                
                if (payloadSessionId === sessionIdRef.current) {
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
        } catch (err) {
          logWithTimestamp(`Error during number updates reconnection: ${err}`, 'error');
        }
      }
    }, 500);
  }, []);

  return {
    calledNumbers,
    currentNumber,
    numberCallTimestamp,
    isConnected,
    reconnect
  };
}
