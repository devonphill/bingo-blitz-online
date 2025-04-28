
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStorage } from './useSessionStorage';
import { useToast } from './use-toast';

interface GameState {
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  activePatterns: string[];
  prizes: any;
  timestamp: number;
}

export function useBingoSync(sessionId?: string) {
  const [gameState, setGameState] = useSessionStorage<GameState>('bingo_game_state', {
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null,
    activePatterns: [],
    prizes: {},
    timestamp: 0
  });
  
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const instanceId = useRef<string>(`instance-${Date.now()}`);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  // Set up real-time listeners for game updates
  useEffect(() => {
    if (!sessionId) {
      console.log("No session ID provided to useBingoSync, skipping setup");
      setConnectionState('disconnected');
      return;
    }
    
    console.log(`[useBingoSync] Setting up real-time listeners for session ${sessionId} (${instanceId.current})`);
    setConnectionState('connecting');
    
    // Use the exact same channel name as the one used in LiveGameView for broadcasting
    const channel = supabase
      .channel('number-broadcast')
      .on('broadcast', 
        { event: 'number-called' }, 
        (payload) => {
          console.log(`[useBingoSync] Received broadcast:`, payload);
          
          if (payload.payload && payload.payload.sessionId === sessionId) {
            const { lastCalledNumber, calledNumbers, activeWinPattern, activePatterns, prizeInfo, timestamp } = payload.payload;
            
            // Ensure we have valid data before updating state
            if (calledNumbers && Array.isArray(calledNumbers)) {
              console.log(`[useBingoSync] Updating game state with ${calledNumbers.length} called numbers and current pattern: ${activeWinPattern}`);
              
              // Create a new state object directly
              const newGameState: GameState = {
                lastCalledNumber: lastCalledNumber !== undefined ? lastCalledNumber : gameState.lastCalledNumber,
                calledNumbers: calledNumbers || gameState.calledNumbers,
                currentWinPattern: activeWinPattern || gameState.currentWinPattern,
                activePatterns: activePatterns || gameState.activePatterns,
                prizes: prizeInfo || gameState.prizes,
                timestamp: timestamp || Date.now()
              };
              
              setGameState(newGameState);
              
              if (lastCalledNumber !== null && lastCalledNumber !== undefined) {
                // Show toast for new number
                toast({
                  title: "New Number Called",
                  description: `Number ${lastCalledNumber} has been called`,
                  duration: 3000
                });
              }
            }
            
            // Mark as connected when we receive a valid payload
            if (!isConnected) {
              setIsConnected(true);
              setConnectionState('connected');
              console.log(`[useBingoSync] Connection established`);
            }
          }
        })
      .subscribe((status) => {
        console.log(`[useBingoSync] Channel status: ${status}, session: ${sessionId}`);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('disconnected');
          
          // Attempt to reconnect after a delay
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = setTimeout(() => {
            console.log('[useBingoSync] Attempting to reconnect...');
            channelRef.current?.subscribe();
          }, 3000);
        }
      });
    
    // Store the channel reference for potential reconnection
    channelRef.current = channel;
    
    return () => {
      console.log(`[useBingoSync] Cleaning up channel for ${sessionId}`);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

  return {
    gameState,
    isConnected,
    connectionState,
    // Add a method to manually sync with the latest state if needed
    syncGameState: (newState: Partial<GameState>) => {
      const updatedState: GameState = {
        ...gameState,
        ...newState,
        timestamp: Date.now()
      };
      setGameState(updatedState);
    }
  };
}
