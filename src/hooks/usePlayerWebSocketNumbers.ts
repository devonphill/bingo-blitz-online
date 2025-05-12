
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

const NUMBER_CALLED_EVENT = 'number-called';
const GAME_UPDATES_CHANNEL = 'game-updates';

/**
 * Hook for managing WebSocket-based number updates
 */
export function usePlayerWebSocketNumbers(sessionId: string | null | undefined) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const instanceId = useRef(`ws-${Math.random().toString(36).substring(2, 7)}`);

  // Function to fetch existing called numbers
  const fetchExistingNumbers = async () => {
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
  };

  const setupChannel = () => {
    if (!sessionId) {
      return;
    }

    try {
      logWithTimestamp(`[${instanceId.current}] Creating number updates channel for session ${sessionId}`, 'info');
      
      // Clean up any existing channel subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Create a new channel subscription
      channelRef.current = supabase.channel(GAME_UPDATES_CHANNEL, {
        config: {
          broadcast: { self: true },
          presence: { key: instanceId.current },
        }
      });

      // Add channel event handlers
      channelRef.current
        .on('broadcast', { event: NUMBER_CALLED_EVENT }, (payload: any) => {
          // Validate the payload
          if (!payload || !payload.payload || !payload.payload.number) {
            logWithTimestamp(`[${instanceId.current}] Received invalid number broadcast payload`, 'warn');
            return;
          }
          
          const { number, sessionId: payloadSessionId } = payload.payload;
          
          // Ensure this event is for our session
          if (payloadSessionId !== sessionId) {
            return;
          }

          logWithTimestamp(`[${instanceId.current}] Received number broadcast: ${number} for session ${payloadSessionId}`, 'info');
          
          // Update our state with the new number
          setLastCalledNumber(number);
          setCalledNumbers(prev => {
            if (prev.includes(number)) return prev;
            return [...prev, number];
          });
        })
        .on('system', { event: 'connection_state_change' }, (payload: any) => {
          logWithTimestamp(`[${instanceId.current}] Connection state changed: ${payload.event}`, 'info');
          setIsConnected(payload.event === 'SUBSCRIBED');
        })
        .subscribe((status: string) => {
          logWithTimestamp(`[${instanceId.current}] Number updates channel status: ${status}`, 'info');
          setIsConnected(status === 'SUBSCRIBED');
        });
    } catch (err) {
      logWithTimestamp(`[${instanceId.current}] Error setting up channel: ${err}`, 'error');
      setIsConnected(false);
    }
  };

  // Setup WebSocket connection when session changes
  useEffect(() => {
    logWithTimestamp(`[${instanceId.current}] Session ID updated to: ${sessionId}`, 'info');
    logWithTimestamp(`[${instanceId.current}] Number updates hook initialized`, 'info');
    
    let mounted = true;
    
    if (sessionId) {
      // Load existing numbers
      fetchExistingNumbers().then(numbers => {
        if (mounted) {
          setCalledNumbers(numbers);
        }
      });
      
      // Setup the channel
      setupChannel();
    }
    
    return () => {
      mounted = false;
      if (channelRef.current) {
        logWithTimestamp(`[${instanceId.current}] Cleaning up number updates channel`, 'info');
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [sessionId]);

  const reconnect = () => {
    logWithTimestamp(`[${instanceId.current}] Manually reconnecting to number updates`, 'info');
    
    // Fetch numbers again
    fetchExistingNumbers().then(numbers => {
      setCalledNumbers(numbers);
    });
    
    // Recreate channel
    setupChannel();
  };

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    reconnect
  };
}
