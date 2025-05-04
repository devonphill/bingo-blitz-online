
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';

// Define interfaces for better type safety
interface BingoSyncState {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  gameState: any;
}

export function useBingoSync(playerCode: string | null, sessionId: string | undefined) {
  // State for connection and game data
  const [state, setState] = useState<BingoSyncState>({
    isLoading: true,
    isConnected: false,
    error: null,
    gameState: null
  });

  // Memoize the submitBingoClaim function to prevent unnecessary re-renders
  const submitBingoClaim = useCallback((ticket: any) => {
    if (!playerCode || !sessionId) {
      logWithTimestamp('Cannot claim bingo: missing player code or session', 'error');
      return false;
    }

    try {
      logWithTimestamp(`Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
      
      // Use the connectionManager to submit the claim
      return connectionManager.submitBingoClaim(ticket, playerCode, sessionId);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error submitting claim';
      logWithTimestamp(`Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  }, [playerCode, sessionId]);

  // Set up connection and game state updates
  useEffect(() => {
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    logWithTimestamp(`Initializing bingo sync for player ${playerCode} in session ${sessionId}`, 'info');

    // Initialize connection using the connection manager
    connectionManager.initialize(sessionId)
      .onGameStateUpdate((gameState) => {
        logWithTimestamp('Received game state update', 'debug');
        setState(prev => ({
          ...prev,
          gameState,
          isLoading: false
        }));
      })
      .onConnectionStatusChange((isConnected) => {
        logWithTimestamp(`Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`, 'info');
        setState(prev => ({
          ...prev,
          isConnected,
          isLoading: false
        }));
      })
      .onError((error) => {
        logWithTimestamp(`Connection error: ${error}`, 'error');
        setState(prev => ({
          ...prev,
          error,
          isLoading: false
        }));
      });

    // Track player presence for this session
    if (playerCode) {
      connectionManager.trackPlayerPresence({
        player_code: playerCode,
        session_id: sessionId
      });
    }

    // Cleanup function to handle component unmount
    return () => {
      logWithTimestamp('Cleaning up bingo sync connection', 'info');
      // The connectionManager handles its own cleanup
    };
  }, [playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
