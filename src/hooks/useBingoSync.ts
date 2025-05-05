
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
  
  // Use the network context instead of directly using connectionManager
  const network = useNetwork();
  
  // Effect to set up connection and listeners
  useEffect(() => {
    // Skip if we don't have necessary data
    if (!playerCode || !sessionId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    logWithTimestamp(`[${hookIdRef.current}] Setting up bingo sync for player ${playerCode} in session ${sessionId}`, 'info');

    // Connect to the session
    network.connect(sessionId);
    
    // Set up event handlers for game state updates, connection status, and errors
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
      isLoading: !network.isConnected
    }));
    
    // Clean up listeners when component unmounts
    return () => {
      removeGameStateListener();
      removeConnectionListener();
    };
  }, [network, playerCode, sessionId]);

  // Memoize the submitBingoClaim function to prevent unnecessary re-renders
  const submitBingoClaim = useCallback((ticket: any) => {
    if (!playerCode || !sessionId) {
      logWithTimestamp('Cannot claim bingo: missing player code or session', 'error');
      return false;
    }

    try {
      logWithTimestamp(`Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
      
      // Use the network context to submit the claim
      return network.submitBingoClaim(ticket, playerCode, sessionId);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error submitting claim';
      logWithTimestamp(`Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  }, [network, playerCode, sessionId]);

  return {
    ...state,
    submitBingoClaim
  };
}
