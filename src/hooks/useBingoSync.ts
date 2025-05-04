
import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Use refs to track initialization status and prevent duplicate setup
  const hookIdRef = useRef<string>(`bingoSync-${Math.random().toString(36).substring(2, 9)}`);
  
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

  // Set up game state updates, connection status monitoring, but NOT connection initialization
  useEffect(() => {
    // Skip if we don't have necessary data
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    logWithTimestamp(`[${hookIdRef.current}] Setting up bingo sync for player ${playerCode} in session ${sessionId}`, 'info');

    // Set up event handlers for game state updates, connection status, and errors
    const onGameStateUpdate = (gameState: any) => {
      logWithTimestamp(`[${hookIdRef.current}] Received game state update`, 'debug');
      setState(prev => ({
        ...prev,
        gameState,
        isLoading: false
      }));
    };
    
    const onConnectionStatusChange = (isConnected: boolean) => {
      logWithTimestamp(`[${hookIdRef.current}] Connection status from manager: ${isConnected ? 'connected' : 'disconnected'}`, 'info');
      setState(prev => ({
        ...prev,
        isConnected,
        isLoading: false
      }));
    };
    
    const onError = (error: string) => {
      logWithTimestamp(`[${hookIdRef.current}] Connection error: ${error}`, 'error');
      setState(prev => ({
        ...prev,
        error,
        isLoading: false
      }));
    };
    
    // Add listeners to connection manager
    connectionManager
      .onGameStateUpdate(onGameStateUpdate)
      .onConnectionStatusChange(onConnectionStatusChange)
      .onError(onError);
    
    // IMPORTANT: This hook no longer tries to initialize the connection
    // That's now the sole responsibility of usePlayerGame
    
    // Check current connection state
    const currentState = connectionManager.getConnectionState();
    setState(prev => ({
      ...prev,
      isConnected: currentState === 'connected',
      isLoading: currentState === 'connecting'
    }));
    
    // No cleanup needed - we're not removing listeners since the connectionManager
    // maintains its own state
    
  }, [playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
