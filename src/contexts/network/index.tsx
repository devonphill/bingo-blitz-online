import React, { createContext, useContext, useState, useEffect } from 'react';
import { logWithTimestamp } from '@/utils/logUtils';
import { setupChannelListeners } from './channelListeners';

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

  const value = {
    sessionId,
    isConnected,
    networkError,
    lastHeartbeat,
    updateSessionId,
    recordHeartbeat,
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
