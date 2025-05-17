
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNetworkContext } from './network';
import { ConnectionState } from '@/constants/connectionConstants';
import { WebSocketConnectionStatus } from '@/constants/websocketConstants';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

interface NetworkStatusContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  reconnect: () => void;
  connect: (sessionId: string) => void;
  sessionId: string | null;
  callNumber: (number: number, sessionId?: string) => Promise<boolean>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isConnected: false,
  connectionState: 'disconnected',
  reconnect: () => {},
  connect: () => {},
  sessionId: null,
  callNumber: async () => false
});

// Helper function to convert WebSocketConnectionStatus to ConnectionState
const mapConnectionState = (wsStatus: WebSocketConnectionStatus): ConnectionState => {
  switch(wsStatus) {
    case 'connected': return 'connected';
    case 'connecting': return 'connecting';
    case 'disconnected': return 'disconnected';
    case 'reconnecting': return 'connecting'; // Map reconnecting to connecting
    default: return 'disconnected';
  }
};

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const { isConnected: networkIsConnected, sessionId } = useNetworkContext();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  
  // Use direct connection to SingleSourceTrueConnections
  useEffect(() => {
    const connection = getSingleSourceConnection();
    
    const cleanup = connection.addStatusListener((status) => {
      // Convert WebSocketConnectionStatus to ConnectionState
      setConnectionState(mapConnectionState(status));
    });
    
    // Call once to set initial state
    setConnectionState(mapConnectionState(connection.getCurrentConnectionState()));
    
    return cleanup;
  }, []);
  
  // Connect to a session
  const connect = useCallback((sessionId: string) => {
    if (sessionId) {
      const connection = getSingleSourceConnection();
      connection.connect(sessionId);
    }
  }, []);
  
  // Reconnect to the current session
  const reconnect = useCallback(() => {
    if (sessionId) {
      const connection = getSingleSourceConnection();
      connection.connect(sessionId);
    }
  }, [sessionId]);
  
  // Call a number for the current session
  const callNumber = useCallback(async (number: number, specificSessionId?: string): Promise<boolean> => {
    const targetSessionId = specificSessionId || sessionId;
    if (!targetSessionId) return false;
    
    try {
      const connection = getSingleSourceConnection();
      const result = await connection.broadcastNumberCalled(targetSessionId, number);
      // Convert any response to boolean
      return result !== false;
    } catch (error) {
      console.error('Error calling number:', error);
      return false;
    }
  }, [sessionId]);
  
  const value: NetworkStatusContextType = {
    isConnected: networkIsConnected,
    connectionState,
    reconnect,
    connect,
    sessionId,
    callNumber
  };
  
  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => useContext(NetworkStatusContext);

// Also provide the useNetwork hook for backward compatibility
export const useNetwork = useNetworkStatus;
