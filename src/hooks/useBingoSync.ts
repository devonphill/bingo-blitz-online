
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager, ConnectionState } from '@/utils/connectionManager';

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

  // Set up connection and game state updates, with debouncing and proper cleanup
  useEffect(() => {
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    // Create a unique ID for this hook instance for better logging
    const hookId = `bingoSync-${Math.random().toString(36).substring(2, 9)}`;
    logWithTimestamp(`[${hookId}] Initializing bingo sync for player ${playerCode} in session ${sessionId}`, 'info');

    // Only add connection state updates here, don't initialize the connection
    // This avoids multiple initialization attempts from different components
    
    // Track the last connection state to avoid unnecessary re-renders
    let lastConnState = false;
    let lastError = null;
    
    // Initialize connection using the connection manager
    connectionManager
      .onGameStateUpdate((gameState) => {
        logWithTimestamp(`[${hookId}] Received game state update`, 'debug');
        setState(prev => ({
          ...prev,
          gameState,
          isLoading: false
        }));
      })
      .onConnectionStatusChange((isConnected) => {
        // Only update state if connection status actually changed
        if (lastConnState !== isConnected) {
          logWithTimestamp(`[${hookId}] Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`, 'info');
          lastConnState = isConnected;
          setState(prev => ({
            ...prev,
            isConnected,
            isLoading: false
          }));
        }
      })
      .onError((error) => {
        // Only update state if error message changed
        if (lastError !== error) {
          logWithTimestamp(`[${hookId}] Connection error: ${error}`, 'error');
          lastError = error;
          setState(prev => ({
            ...prev,
            error,
            isLoading: false
          }));
        }
      });

    // Track player presence for this session
    if (playerCode) {
      connectionManager.trackPlayerPresence({
        player_code: playerCode,
        session_id: sessionId
      });
    }

    // Initialization happens elsewhere (in ConnectionManager or PlayerGame),
    // this hook just attaches listeners but doesn't call initialize directly

    // Regular status check to ensure our hook state matches the real connection state
    const intervalId = setInterval(() => {
      const currentConnectionState = connectionManager.getConnectionState();
      const isCurrentlyConnected = currentConnectionState === 'connected';
      
      if (lastConnState !== isCurrentlyConnected) {
        logWithTimestamp(`[${hookId}] Detected connection state change during interval check to ${isCurrentlyConnected ? 'connected' : 'disconnected'}`, 'info');
        lastConnState = isCurrentlyConnected;
        setState(prev => ({
          ...prev,
          isConnected: isCurrentlyConnected,
          isLoading: false
        }));
      }
    }, 5000);

    // Cleanup function to handle component unmount
    return () => {
      logWithTimestamp(`[${hookId}] Cleaning up bingo sync connection monitoring`, 'info');
      clearInterval(intervalId);
    };
  }, [playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
