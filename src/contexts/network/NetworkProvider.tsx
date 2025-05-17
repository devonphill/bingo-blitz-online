
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { performClaimBroadcast } from './claimHandlers';
import { setupChannelListeners } from './channelListeners';
import { NetworkProviderProps, NetworkContextType } from './types';
import { updatePlayerPresence } from './playerPresence';

// Create Context
export const NetworkContext = createContext<NetworkContextType>({
  isConnected: false,
  sessionId: null,
  claimStatus: null,
  connect: () => {},
  submitBingoClaim: () => false,
  sendClaimValidation: async () => false,
  updatePlayerPresence: async () => false,
});

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ 
  children,
  initialSessionId = null,
}) => {
  // State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [claimStatus, setClaimStatus] = useState<any>(null);
  const [lastPingTime, setLastPingTime] = useState<number>(0);

  // Get the singleton connection
  const connection = getSingleSourceConnection();

  // Connect to a session
  const connect = useCallback((newSessionId: string) => {
    if (!newSessionId) {
      logWithTimestamp('Cannot connect: No session ID provided', 'error');
      return;
    }

    logWithTimestamp(`Connecting to session: ${newSessionId}`, 'info');
    setSessionId(newSessionId);

    // Use the singleton connection to manage the actual connection
    connection.connect(newSessionId);

    // Update last ping time if the method exists
    const lastPing = connection.getLastPing?.();
    if (lastPing) {
      setLastPingTime(typeof lastPing === 'number' ? lastPing : lastPing.getTime());
    }
  }, [connection]);

  // Initialize with initial session ID if provided
  useEffect(() => {
    if (initialSessionId) {
      connect(initialSessionId);
    }

    // Set up a connection listener
    const cleanup = connection.addConnectionListener((connected) => {
      setIsConnected(connected);
    });

    // Return cleanup function
    return () => {
      cleanup();
    };
  }, [connection, connect, initialSessionId]);

  // Claim submission
  const submitBingoClaim = useCallback((ticket: any, playerCode: string, gameSessionId: string) => {
    if (!isConnected) {
      logWithTimestamp('Cannot submit claim: WebSocket not connected', 'error');
      return false;
    }

    // Use the claim broadcast utility
    return performClaimBroadcast(ticket, playerCode, gameSessionId);
  }, [isConnected]);

  // Claim validation
  const sendClaimValidation = useCallback(async (claimId: string, isValid: boolean, sessionId: string) => {
    if (!connection) {
      logWithTimestamp('Cannot send claim validation: No WebSocket connection', 'error');
      return false;
    }

    try {
      // Broadcast validation result
      // Import CHANNEL_NAMES and EVENT_TYPES
      const { CHANNEL_NAMES, EVENT_TYPES } = await import('@/constants/websocketConstants');

      const result = await connection.broadcast(
        'CLAIM_UPDATES_BASE',
        'claim-validation',
        {
          claimId,
          isValid,
          sessionId,
          timestamp: new Date().toISOString()
        }
      );

      logWithTimestamp(`Claim validation ${claimId} sent: ${result}`, 'info');
      // Ensure we return a boolean value
      return result === true || result === 'ok' || false;
    } catch (error) {
      logWithTimestamp(`Error sending claim validation: ${error}`, 'error');
      return false;
    }
  }, [connection]);

  // Player presence
  const updatePlayerPresence = useCallback(async (sessionId: string, playerData: any) => {
    return updatePlayerPresence(sessionId, playerData);
  }, []);

  // Set up channel listeners
  useEffect(() => {
    if (!sessionId || !isConnected) return;

    const cleanupListeners = setupChannelListeners(
      sessionId,
      (claimData: any) => {
        setClaimStatus(claimData);
      }
    );

    return cleanupListeners;
  }, [sessionId, isConnected]);

  // Context value
  const contextValue: NetworkContextType = {
    isConnected,
    sessionId,
    claimStatus,
    connect,
    submitBingoClaim,
    sendClaimValidation,
    updatePlayerPresence,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkContext = () => useContext(NetworkContext);
