
import { useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';

// Define interfaces for better type safety
interface BingoSyncState {
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  gameState: any;
}

/**
 * Hook to sync bingo game state via the network connection
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

  // Use refs to track initialization status and create instance ID for better logging
  const hookIdRef = useRef<string>(`bingoSync-${Math.random().toString(36).substring(2, 9)}`);
  const listenersSetupRef = useRef<boolean>(false);
  
  // Use the network context 
  const network = useNetwork();
  
  // Effect to set up listeners only (not connection)
  useEffect(() => {
    // Skip if we don't have necessary data
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      logWithTimestamp(`[${hookIdRef.current}] Missing playerCode or sessionId, skipping listener setup`, 'info');
      return;
    }

    if (listenersSetupRef.current) {
      logWithTimestamp(`[${hookIdRef.current}] Listeners already set up, skipping`, 'debug');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    logWithTimestamp(`[${hookIdRef.current}] Setting up bingo sync listeners for player ${playerCode} in session ${sessionId}`, 'info');

    // Set up event handlers for game state updates, connection status
    const removeGameStateListener = network.addGameStateUpdateListener((gameState) => {
      logWithTimestamp(`[${hookIdRef.current}] Received game state update`, 'debug');
      setState(prev => ({
        ...prev,
        gameState,
        isLoading: false
      }));
    });
    
    const removeConnectionListener = network.addConnectionStatusListener((isConnected) => {
      logWithTimestamp(`[${hookIdRef.current}] Connection status: ${isConnected ? 'connected' : 'disconnected'}`, 'info');
      setState(prev => ({
        ...prev,
        isConnected,
        isLoading: false
      }));
    });
    
    // Set initial state based on current connection status
    setState(prev => ({
      ...prev,
      isConnected: network.isConnected,
      isLoading: false
    }));

    // Mark listeners as set up
    listenersSetupRef.current = true;
    
    // Clean up listeners when component unmounts
    return () => {
      removeGameStateListener();
      removeConnectionListener();
      listenersSetupRef.current = false;
      logWithTimestamp(`[${hookIdRef.current}] Cleaning up bingo sync listeners`, 'debug');
    };
  }, [network, playerCode, sessionId]);

  // Effect specifically for connection management
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`[${hookIdRef.current}] No session ID available, can't connect`, 'info');
      return;
    }

    // The actual connection is managed by the NetworkStatusContext
    // Here we just ensure it's connected
    if (!network.isConnected && sessionId) {
      logWithTimestamp(`[${hookIdRef.current}] Ensuring connection to session ${sessionId}`, 'info');
      network.connect(sessionId);
    }

    // No cleanup here as the connection is managed by the context
  }, [network, sessionId]);

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
  }, [network, playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
