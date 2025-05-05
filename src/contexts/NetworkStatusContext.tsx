
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { connectionManager, ConnectionState } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';

interface NetworkContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastPingTime: number | null;
  connect: (sessionId: string) => void;
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
  fetchClaims: (sessionId?: string) => Promise<any[]>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const connectedSessionId = useRef<string | null>(null);
  
  // Update local state based on connection manager state
  const updateConnectionState = useCallback(() => {
    const state = connectionManager.getConnectionState();
    setConnectionState(state);
    setLastPingTime(connectionManager.getLastPing());
  }, []);
  
  // Connect to a session
  const connect = useCallback((sessionId: string) => {
    // Don't reconnect if already connected to this session
    if (connectedSessionId.current === sessionId && connectionManager.isConnected()) {
      logWithTimestamp(`Already connected to session: ${sessionId}`, 'info');
      return;
    }
    
    logWithTimestamp(`Connecting to session: ${sessionId}`, 'info');
    connectionManager.connect(sessionId);
    connectedSessionId.current = sessionId;
    updateConnectionState();
  }, [updateConnectionState]);
  
  // Call a bingo number
  const callNumber = useCallback(async (number: number, sessionId?: string): Promise<boolean> => {
    const result = await connectionManager.callNumber(number, sessionId);
    updateConnectionState();
    return result;
  }, [updateConnectionState]);
  
  // Fetch pending claims
  const fetchClaims = useCallback(async (sessionId?: string): Promise<any[]> => {
    return await connectionManager.fetchClaims(sessionId);
  }, []);
  
  return (
    <NetworkContext.Provider
      value={{
        connectionState,
        isConnected: connectionState === 'connected',
        lastPingTime,
        connect,
        callNumber,
        fetchClaims
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
