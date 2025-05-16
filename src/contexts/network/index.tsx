
import React, { createContext, useContext, useState, useEffect } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { setupChannelListeners } from './channelListeners';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

export const NetworkContext = createContext<any>(null);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [networkError, setNetworkError] = useState<Error | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  // Handle network errors
  const handleNetworkError = (error: any) => {
    logWithTimestamp(`Network error: ${error.message || 'Unknown error'}`, 'error');
    setNetworkError(error instanceof Error ? error : new Error(String(error)));
    setIsConnected(false);
  };

  // Update session ID
  const updateSessionId = (id: string | null) => {
    if (id !== sessionId) {
      logWithTimestamp(`Network context: Updating session ID to ${id}`, 'info');
      setSessionId(id);
    }
  };

  // Record heartbeat
  const recordHeartbeat = () => {
    setLastHeartbeat(new Date());
    setIsConnected(true);
  };

  // Submit bingo claim
  const submitBingoClaim = (ticket: any, playerCode: string, sessionId: string) => {
    if (!ticket || !playerCode || !sessionId) {
      logWithTimestamp('Cannot submit bingo claim: Missing required parameters', 'error');
      return false;
    }

    try {
      const singleSource = getSingleSourceConnection();
      
      // Prepare claim data
      const claimData = {
        playerCode,
        sessionId,
        ticket,
        timestamp: new Date().toISOString()
      };
      
      // Broadcast claim
      singleSource.broadcast(CHANNEL_NAMES.CLAIM_UPDATES, EVENT_TYPES.CLAIM_SUBMITTED, claimData);
      
      logWithTimestamp(`Bingo claim submitted for player ${playerCode}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  };

  // Set up channel listeners when session ID changes
  useEffect(() => {
    if (sessionId) {
      // Make sure to pass the correct arguments
      const cleanupListeners = setupChannelListeners(sessionId, handleNetworkError);
      return () => {
        cleanupListeners();
      };
    }
  }, [sessionId]);

  // Monitor connection status
  useEffect(() => {
    if (!sessionId) return;

    const checkConnectionStatus = () => {
      if (lastHeartbeat) {
        const now = new Date();
        const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
        
        // If no heartbeat in 30 seconds, consider disconnected
        if (timeSinceLastHeartbeat > 30000) {
          setIsConnected(false);
        }
      }
    };

    const interval = setInterval(checkConnectionStatus, 10000);
    return () => clearInterval(interval);
  }, [sessionId, lastHeartbeat]);

  // Connect function
  const connect = (sessionId: string) => {
    if (!sessionId) {
      logWithTimestamp('Cannot connect: No session ID provided', 'error');
      return false;
    }
    
    logWithTimestamp(`Connecting to session ${sessionId}`, 'info');
    updateSessionId(sessionId);
    
    // Use SingleSourceTrueConnections to connect
    const singleSource = getSingleSourceConnection();
    return singleSource.connect(sessionId);
  };

  const value = {
    sessionId,
    isConnected,
    networkError,
    lastHeartbeat,
    updateSessionId,
    recordHeartbeat,
    connect,
    submitBingoClaim
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkContext = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetworkContext must be used within a NetworkProvider');
  }
  return context;
};

// Export a temporary useNetwork hook to fix build errors
export const useNetwork = () => {
  const {
    sessionId,
    isConnected,
    networkError,
    lastHeartbeat,
    updateSessionId,
    recordHeartbeat,
    connect,
    submitBingoClaim
  } = useNetworkContext();
  
  return {
    sessionId,
    isConnected,
    networkError,
    lastHeartbeat,
    updateSessionId,
    recordHeartbeat,
    connect,
    submitBingoClaim
  };
};

// Export ConnectionState from constants for components that need it
export { ConnectionState } from '@/constants/connectionConstants';
