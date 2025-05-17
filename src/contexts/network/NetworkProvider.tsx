
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { logWithTimestamp } from '@/utils/logUtils';
import { NetworkProviderProps, NetworkContextType } from './types';
import { CONNECTION_STATES } from '@/constants/websocketConstants';
import { EVENT_TYPES } from '@/constants/websocketConstants';

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
  const [connectionTimestamp, setConnectionTimestamp] = useState<number>(0);

  // Get the singleton connection
  const ncmSpot = getNCMInstance();

  // Connect to a session
  const connect = useCallback((newSessionId: string) => {
    if (!newSessionId) {
      logWithTimestamp('Cannot connect: No session ID provided', 'error');
      return;
    }

    logWithTimestamp(`Connecting to session: ${newSessionId}`, 'info');
    setSessionId(newSessionId);

    // Use NCM_SPOT to connect to the session
    ncmSpot.connectToSession(newSessionId);
  }, []);

  // Initialize with initial session ID if provided
  useEffect(() => {
    if (initialSessionId) {
      connect(initialSessionId);
    }

    // Set up a connection status listener
    const cleanup = ncmSpot.addOverallStatusListener((status, isServiceReady) => {
      setIsConnected(status === CONNECTION_STATES.CONNECTED && isServiceReady);
      if (status === CONNECTION_STATES.CONNECTED && isServiceReady) {
        setConnectionTimestamp(Date.now());
      }
    });

    // Return cleanup function
    return () => {
      cleanup();
    };
  }, [connect, initialSessionId]);

  // Claim submission
  const submitBingoClaim = useCallback((ticket: any, playerCode: string, gameSessionId: string) => {
    if (!isConnected) {
      logWithTimestamp('Cannot submit claim: WebSocket not connected', 'error');
      return false;
    }

    try {
      // Use NCM_SPOT to broadcast the claim
      const channelName = `claim_sender-${gameSessionId}`;
      const payload = {
        ticket,
        playerCode,
        sessionId: gameSessionId,
        timestamp: new Date().toISOString()
      };
      
      ncmSpot.broadcast(channelName, EVENT_TYPES.CLAIM_SUBMITTED, payload);
      return true;
    } catch (error) {
      logWithTimestamp(`Error submitting claim: ${error}`, 'error');
      return false;
    }
  }, [isConnected]);

  // Claim validation
  const sendClaimValidation = useCallback(async (claimId: string, isValid: boolean, sessionId: string) => {
    if (!ncmSpot.isOverallConnected()) {
      logWithTimestamp('Cannot send claim validation: No WebSocket connection', 'error');
      return false;
    }

    try {
      // Use NCM_SPOT to send the message on the claims validation channel
      const channelName = `claims_validation-${sessionId}`;
      const payload = {
        claimId,
        isValid,
        sessionId,
        timestamp: new Date().toISOString()
      };
      
      await ncmSpot.broadcast(channelName, EVENT_TYPES.CLAIM_RESOLUTION, payload);
      logWithTimestamp(`Claim validation ${claimId} sent`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Error sending claim validation: ${error}`, 'error');
      return false;
    }
  }, []);

  // Player presence
  const updatePlayerPresence = useCallback(async (sessionId: string, playerData: any) => {
    if (!sessionId || !playerData) {
      logWithTimestamp('Cannot update player presence: Missing data', 'error');
      return false;
    }
    
    try {
      ncmSpot.trackPlayerPresence(sessionId, {
        username: playerData.name || playerData.username || 'Unknown Player',
        playerCode: playerData.playerCode || 'unknown',
        status: 'online'
      });
      return true;
    } catch (error) {
      logWithTimestamp(`Error updating player presence: ${error}`, 'error');
      return false;
    }
  }, []);

  // Set up channel listeners for claims
  useEffect(() => {
    if (!sessionId || !isConnected) return;

    // Listen for claims on the claim sender channel
    const claimChannelName = `claim_sender-${sessionId}`;
    const claimCleanup = ncmSpot.listenForEvent(
      claimChannelName,
      EVENT_TYPES.CLAIM_SUBMITTED,
      (claimData: any) => {
        logWithTimestamp(`Received claim: ${JSON.stringify(claimData)}`, 'info');
        setClaimStatus(claimData);
      }
    );

    return () => {
      claimCleanup();
    };
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
