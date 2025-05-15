
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { addGameStateUpdateListener, addConnectionStatusListener, addNumberCalledListener } from './channelListeners';
import { updatePlayerPresence } from './playerPresence';
import { fetchClaimsForSession, submitBingoClaim, validateClaim } from './claimHandlers';
import { connectToSession, callNumber } from './networkOperations';
import { NetworkContextType, ConnectionState } from './types';

// Create context with undefined initial value
const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

/**
 * Network Provider component
 * Manages network state and operations
 */
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const connectedSessionId = useRef<string | null>(null);
  
  // Get the SingleSourceTrueConnections instance
  const singleSource = getSingleSourceConnection();
  
  // Initialize SingleSourceTrueConnections on mount
  useEffect(() => {
    // This ensures SingleSourceTrueConnections is initialized
    getSingleSourceConnection();
  }, []);
  
  // Update local state based on connection state
  const updateConnectionState = useCallback(() => {
    const state = singleSource.getConnectionState() as ConnectionState;
    setConnectionState(state);
    setLastPingTime(singleSource.getLastPing());
  }, [singleSource]);
  
  // Set up connection status listener
  useEffect(() => {
    // Add connection status listener to update our local state
    const removeListener = singleSource.addConnectionListener((isConnected) => {
      updateConnectionState();
    });
    
    // Initial state update
    updateConnectionState();
    
    return () => {
      removeListener();
    };
  }, [singleSource, updateConnectionState]);
  
  // Connect to a session
  const connect = useCallback((sessionId: string) => {
    const connected = connectToSession(sessionId, connectedSessionId.current);
    
    if (connected || !connectedSessionId.current) {
      connectedSessionId.current = sessionId;
      updateConnectionState();
    }
  }, [updateConnectionState]);
  
  // Call a bingo number
  const callNumberHandler = useCallback(async (number: number, sessionId?: string): Promise<boolean> => {
    const result = await callNumber(number, sessionId || connectedSessionId.current || undefined);
    updateConnectionState();
    return result;
  }, [updateConnectionState]);
  
  // Fetch pending claims
  const fetchClaims = useCallback(async (sessionId?: string): Promise<any[]> => {
    return fetchClaimsForSession(sessionId || connectedSessionId.current);
  }, []);

  // Validate a claim
  const validateClaimHandler = useCallback(async (claim: any, isValid: boolean): Promise<boolean> => {
    return validateClaim(claim, isValid, connectedSessionId.current);
  }, []);
  
  // Add game state update listener
  const addGameStateUpdateListenerHandler = useCallback((callback: (gameState: any) => void): (() => void) => {
    return addGameStateUpdateListener(connectedSessionId.current, callback);
  }, []);
  
  // Add connection status listener
  const addConnectionStatusListenerHandler = useCallback((callback: (isConnected: boolean) => void): (() => void) => {
    return addConnectionStatusListener(() => singleSource.isConnected(), callback);
  }, [singleSource]);
  
  // Add number called listener
  const addNumberCalledListenerHandler = useCallback((callback: (number: number | null, calledNumbers: number[]) => void): (() => void) => {
    return addNumberCalledListener(connectedSessionId.current, callback);
  }, []);

  // Submit bingo claim
  const submitBingoClaimHandler = useCallback((ticket: any, playerCode: string, sessionId: string): boolean => {
    return submitBingoClaim(ticket, playerCode, sessionId);
  }, []);
  
  return (
    <NetworkContext.Provider
      value={{
        connectionState,
        isConnected: connectionState === 'connected',
        lastPingTime,
        sessionId: connectedSessionId.current,
        connect,
        callNumber: callNumberHandler,
        fetchClaims,
        updatePlayerPresence,
        addGameStateUpdateListener: addGameStateUpdateListenerHandler,
        addConnectionStatusListener: addConnectionStatusListenerHandler,
        addNumberCalledListener: addNumberCalledListenerHandler,
        submitBingoClaim: submitBingoClaimHandler,
        validateClaim: validateClaimHandler
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Hook to use the network context
 * @returns Network context
 * @throws Error if used outside NetworkProvider
 */
export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
