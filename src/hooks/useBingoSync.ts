import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface GameState {
  lastCalledNumber: number | null;
  calledNumbers: number[];
  currentWinPattern: string | null;
  currentPrize: string | null;
  currentPrizeDescription: string | null;
  gameStatus: string | null;
  lastUpdate: number;
}

export function useBingoSync(sessionId?: string) {
  const [gameState, setGameState] = useState<GameState>({
    lastCalledNumber: null,
    calledNumbers: [],
    currentWinPattern: null,
    currentPrize: null,
    currentPrizeDescription: null,
    gameStatus: null,
    lastUpdate: Date.now()
  });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  useEffect(() => {
    if (!sessionId) {
      console.log("No sessionId provided to useBingoSync");
      setConnectionState('disconnected');
      return;
    }

    console.log(`Setting up real-time subscription for session: ${sessionId}`);
    setConnectionState('connecting');

    // Subscribe to the session progress updates
    const progressSubscription = supabase
      .channel('session-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          console.log("Received session progress update:", payload);
          
          // Update local state based on progress changes
          if (payload.new) {
            setGameState(prev => ({
              ...prev,
              calledNumbers: payload.new.called_numbers || prev.calledNumbers,
              lastCalledNumber: 
                payload.new.called_numbers && 
                payload.new.called_numbers.length > 0 ? 
                payload.new.called_numbers[payload.new.called_numbers.length - 1] : 
                prev.lastCalledNumber,
              currentWinPattern: payload.new.current_win_pattern || prev.currentWinPattern,
              currentPrize: payload.new.current_prize || prev.currentPrize,
              currentPrizeDescription: payload.new.current_prize_description || prev.currentPrizeDescription,
              gameStatus: payload.new.game_status || prev.gameStatus
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log(`Session progress subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('error');
        }
      });

    // Subscribe to broadcast events for called numbers
    const broadcastSubscription = supabase
      .channel('number-broadcast')
      .on('broadcast', { event: 'number-called' }, (payload) => {
        console.log("Received number broadcast:", payload);
        
        if (payload.payload && payload.payload.sessionId === sessionId) {
          const { lastCalledNumber, calledNumbers, activeWinPattern, timestamp } = payload.payload;
          
          setGameState(prev => ({
            ...prev,
            lastCalledNumber: lastCalledNumber || prev.lastCalledNumber,
            calledNumbers: calledNumbers || prev.calledNumbers,
            currentWinPattern: activeWinPattern || prev.currentWinPattern,
            lastUpdate: timestamp || Date.now()
          }));
        }
      })
      .subscribe();

    // Cleanup function
    return () => {
      console.log("Cleaning up real-time subscriptions");
      supabase.removeChannel(progressSubscription);
      supabase.removeChannel(broadcastSubscription);
    };
  }, [sessionId]);
  
  return {
    gameState,
    isConnected,
    connectionState
  };
}
