
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for subscribing to called numbers via WebSockets
 */
export function usePlayerWebSocketNumbers(sessionId: string | null) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  // Update sessionId ref when it changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Clean up function to remove WebSocket connection
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      try {
        logWithTimestamp('Removing numbers WebSocket channel', 'info');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      } catch (error) {
        console.error('Error removing WebSocket channel:', error);
      }
    }
  }, []);

  // Listen for real-time number updates
  useEffect(() => {
    if (!sessionId) return;

    logWithTimestamp(`Setting up WebSocket listener for numbers in session ${sessionId}`, 'info');

    const channelName = 'game-updates';
    const eventName = 'number-called';

    try {
      // Clean up existing channel if any
      cleanup();

      // Create new channel
      const channel = supabase
        .channel(channelName)
        .on('broadcast', { event: eventName }, (payload) => {
          // Only process if the session ID matches our current session
          if (payload.payload?.sessionId === sessionIdRef.current) {
            logWithTimestamp('Received real-time number update', 'info');
            
            // Extract the complete called numbers array and last called number
            const payload_calledNumbers = payload.payload.calledNumbers || [];
            const payload_lastCalledNumber = payload.payload.lastCalledNumber || null;
            
            setCalledNumbers(payload_calledNumbers);
            setLastCalledNumber(payload_lastCalledNumber);
          }
        })
        .subscribe((status) => {
          logWithTimestamp(`WebSocket subscription status: ${status}`, 'info');
          setIsConnected(status === 'SUBSCRIBED');
        });

      // Store channel reference
      channelRef.current = channel;

      // Fetch initial numbers from the database
      fetchNumbers(sessionId);

      return cleanup;
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      return cleanup;
    }
  }, [sessionId, cleanup]);

  // Fetch called numbers from the database
  const fetchNumbers = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        logWithTimestamp(`Error fetching called numbers: ${error.message}`, 'error');
        return;
      }

      if (data && Array.isArray(data.called_numbers)) {
        setCalledNumbers(data.called_numbers);
        
        // Set last called number if array is not empty
        if (data.called_numbers.length > 0) {
          setLastCalledNumber(data.called_numbers[data.called_numbers.length - 1]);
        }
      }
    } catch (error) {
      console.error('Error fetching called numbers:', error);
    }
  }, []);

  // Force refresh called numbers from database
  const refreshNumbers = useCallback(() => {
    if (sessionIdRef.current) {
      fetchNumbers(sessionIdRef.current);
    }
  }, [fetchNumbers]);

  return {
    calledNumbers,
    lastCalledNumber,
    isConnected,
    refreshNumbers
  };
}
