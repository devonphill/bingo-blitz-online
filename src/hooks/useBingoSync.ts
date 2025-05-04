
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
  const initRef = useRef<boolean>(false);
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

  // Set up connection and game state updates, with debouncing and proper cleanup
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
    
    // Connect if not already connected
    if (!connectionManager.isConnected()) {
      // Only initialize if not already done
      // Note: We don't initialize here, but instead let usePlayerGame handle it
      // This avoids multiple initialization attempts from different components
      
      // We can check connection status though
      const currentState = connectionManager.getConnectionState();
      
      setState(prev => ({
        ...prev,
        isConnected: currentState === 'connected',
        isLoading: currentState === 'connecting'
      }));
    }
    
    // Cleanup function for the hook - but we don't disconnect
    // as other components may still need the connection
    return () => {
      logWithTimestamp(`[${hookIdRef.current}] Cleaning up bingo sync listeners`, 'info');
      // We don't need explicit cleanup since connectionManager maintains its own state
      // and listeners list
    };
  }, [playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
