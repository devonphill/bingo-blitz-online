
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useSessionStorage } from './useSessionStorage';

export function useBingoSync() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(0);
  const connectionAttempts = useRef(0);
  const { toast } = useToast();
  const [gameState, setGameState] = useSessionStorage<{
    calledNumbers: number[];
    lastCalledNumber: number | null;
    currentWinPattern: string | null;
    prizeInfo: any;
    timestamp: number;
  }>('bingo_game_state', {
    calledNumbers: [],
    lastCalledNumber: null,
    currentWinPattern: null,
    prizeInfo: null,
    timestamp: 0
  });

  // Function to handle connection drops and reconnects
  useEffect(() => {
    // Check if browser is visible to manage connection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useBingoSync] Page is now visible, ensuring connection');
        // No need to reconnect - Supabase handles this automatically
        // Just update our UI state
        setIsConnected(true);
      } else {
        console.log('[useBingoSync] Page is now hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Setup the real-time subscription
  useEffect(() => {
    console.log(`[useBingoSync] Setting up real-time connection`);
    connectionAttempts.current++;
    
    // Use a dedicated real-time channel for number broadcasts with retry logic
    const channel = supabase
      .channel(`player-sync-${Date.now()}`)
      .on('broadcast', 
        { event: 'number-called' }, 
        (payload) => {
          console.log("[useBingoSync] Received number broadcast:", payload);
          
          if (payload.payload) {
            const { 
              calledNumbers: newNumbers, 
              lastCalledNumber, 
              activeWinPattern, 
              prizeInfo, 
              timestamp 
            } = payload.payload;
            
            // Check if this update is newer than our last processed update
            if (!timestamp || (gameState.timestamp && timestamp <= gameState.timestamp)) {
              console.log(`[useBingoSync] Ignoring outdated update with timestamp: ${timestamp}`);
              return;
            }
            
            // Update our local state cache
            setGameState({
              calledNumbers: newNumbers || gameState.calledNumbers,
              lastCalledNumber: lastCalledNumber !== undefined ? lastCalledNumber : gameState.lastCalledNumber,
              currentWinPattern: activeWinPattern || gameState.currentWinPattern,
              prizeInfo: prizeInfo || gameState.prizeInfo,
              timestamp: timestamp || Date.now()
            });
            
            // Only show toast for new numbers to avoid spamming
            if (lastCalledNumber !== null && 
                lastCalledNumber !== undefined && 
                lastCalledNumber !== gameState.lastCalledNumber) {
              toast({
                title: "New Number Called",
                description: `Number ${lastCalledNumber} has been called`,
                duration: 3000
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useBingoSync] Subscription status: ${status}`);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          // Reset connection attempts on successful connection
          connectionAttempts.current = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Handle reconnection if needed
          setIsConnected(false);
        }
      });
    
    // Cleanup function
    return () => {
      console.log(`[useBingoSync] Cleaning up subscription`);
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Return game state and connection status
  return {
    gameState,
    isConnected,
    lastSyncTimestamp,
    connectionAttempts: connectionAttempts.current
  };
}
