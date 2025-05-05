
import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { supabase } from '@/integrations/supabase/client';

// Define interfaces for better type safety
interface BingoSyncState {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  gameState: any;
}

/**
 * Hook to sync bingo game state via database subscriptions
 * @param playerCode The player's code
 * @param sessionId The game session ID
 * @returns State and methods for interacting with the game
 */
export function useBingoSync(playerCode: string | null, sessionId: string | undefined) {
  // State for connection and game data
  const [state, setState] = useState<BingoSyncState>({
    isLoading: true,
    isConnected: false,
    error: null,
    gameState: null
  });

  // Use refs to track initialization status 
  const hookIdRef = useRef<string>(`bingoSync-${Math.random().toString(36).substring(2, 9)}`);
  
  // Use the network context 
  const network = useNetwork();
  
  // Effect for initial data loading and to establish database subscription
  useEffect(() => {
    // Skip if we don't have necessary data
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      logWithTimestamp(`[${hookIdRef.current}] Missing playerCode or sessionId, skipping setup`, 'info');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    logWithTimestamp(`[${hookIdRef.current}] Setting up bingo sync for player ${playerCode} in session ${sessionId}`, 'info');

    // Initialize connection with the network context
    network.connect(sessionId);

    // First, load the initial session progress data
    const loadSessionProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();
          
        if (error) {
          logWithTimestamp(`[${hookIdRef.current}] Error loading session progress: ${error.message}`, 'error');
          setState(prev => ({ 
            ...prev, 
            error: `Error loading game data: ${error.message}`,
            isLoading: false
          }));
          return;
        }
        
        if (data) {
          logWithTimestamp(`[${hookIdRef.current}] Loaded initial session progress`, 'info');
          
          const gameState = {
            sessionId: data.session_id,
            gameNumber: data.current_game_number,
            maxGameNumber: data.max_game_number,
            gameType: data.current_game_type,
            calledNumbers: data.called_numbers || [],
            lastCalledNumber: data.called_numbers && data.called_numbers.length > 0 
              ? data.called_numbers[data.called_numbers.length - 1] 
              : null,
            currentWinPattern: data.current_win_pattern,
            currentPrize: data.current_prize,
            gameStatus: data.game_status
          };
          
          setState(prev => ({
            ...prev,
            gameState,
            isLoading: false,
            isConnected: true
          }));
        }
      } catch (err) {
        logWithTimestamp(`[${hookIdRef.current}] Exception loading session progress: ${(err as Error).message}`, 'error');
        setState(prev => ({ 
          ...prev, 
          error: `Error loading game data: ${(err as Error).message}`,
          isLoading: false
        }));
      }
    };
    
    // Load initial data
    loadSessionProgress();
    
    // Set up session progress subscription
    const progressChannel = supabase
      .channel(`progress-sync-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions_progress',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const newData = payload.new as any;
        logWithTimestamp(`[${hookIdRef.current}] Received sessions_progress update`, 'info');
        
        if (newData) {
          const gameState = {
            sessionId: newData.session_id,
            gameNumber: newData.current_game_number,
            maxGameNumber: newData.max_game_number,
            gameType: newData.current_game_type,
            calledNumbers: newData.called_numbers || [],
            lastCalledNumber: newData.called_numbers && newData.called_numbers.length > 0 
              ? newData.called_numbers[newData.called_numbers.length - 1] 
              : null,
            currentWinPattern: newData.current_win_pattern,
            currentPrize: newData.current_prize,
            gameStatus: newData.game_status
          };
          
          setState(prev => ({
            ...prev,
            gameState,
            isLoading: false,
            isConnected: true
          }));
        }
      })
      .subscribe();
    
    // Update player presence periodically
    let presenceInterval: any = null;
    const updatePresenceData = async () => {
      if (playerCode && sessionId) {
        try {
          // Get player data
          const { data: playerData } = await supabase
            .from('players')
            .select('id, nickname')
            .eq('player_code', playerCode)
            .single();
            
          if (playerData) {
            // Update presence
            await network.updatePlayerPresence({
              player_id: playerData.id,
              player_code: playerCode,
              nickname: playerData.nickname || playerCode
            });
          }
        } catch (err) {
          logWithTimestamp(`[${hookIdRef.current}] Error updating presence: ${(err as Error).message}`, 'error');
        }
      }
    };
    
    // Update presence immediately and then every 30 seconds
    updatePresenceData();
    presenceInterval = setInterval(updatePresenceData, 30000);
    
    // Set up game state update listener from the network context
    const removeGameStateListener = network.addGameStateUpdateListener((gameState) => {
      if (gameState) {
        setState(prev => ({
          ...prev,
          gameState,
          isLoading: false,
          isConnected: true
        }));
      }
    });
    
    // Set up connection status listener
    const removeConnectionListener = network.addConnectionStatusListener((isConnected) => {
      setState(prev => ({
        ...prev,
        isConnected,
        isLoading: false
      }));
    });
    
    // Clean up listeners and intervals when component unmounts
    return () => {
      supabase.removeChannel(progressChannel);
      removeGameStateListener();
      removeConnectionListener();
      if (presenceInterval) clearInterval(presenceInterval);
      logWithTimestamp(`[${hookIdRef.current}] Cleaning up bingo sync listeners`, 'debug');
    };
  }, [network, playerCode, sessionId]);

  // Update the state based on current connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected: network.isConnected
    }));
  }, [network.isConnected]);

  // Memoize the submitBingoClaim function to prevent unnecessary re-renders
  const submitBingoClaim = useCallback((ticket: any) => {
    if (!playerCode || !sessionId) {
      logWithTimestamp(`[${hookIdRef.current}] Cannot claim bingo: missing player code or session`, 'error');
      return false;
    }

    try {
      logWithTimestamp(`[${hookIdRef.current}] Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
      
      // Use the network context to submit the claim
      return network.submitBingoClaim(ticket, playerCode, sessionId);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error submitting claim';
      logWithTimestamp(`[${hookIdRef.current}] Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  }, [network, playerCode, sessionId, hookIdRef]);

  return {
    ...state,
    submitBingoClaim
  };
}
