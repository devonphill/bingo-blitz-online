
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNetworkContext } from './network';
import { ConnectionState } from '@/constants/connectionConstants';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

interface NetworkStatusContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  reconnect: () => void;
  sessionId: string | null;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isConnected: false,
  connectionState: 'disconnected',
  reconnect: () => {},
  sessionId: null
});

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const { isConnected: networkIsConnected, sessionId, connect } = useNetworkContext();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  
  // Use direct connection to SingleSourceTrueConnections
  useEffect(() => {
    const connection = getSingleSourceConnection();
    
    const cleanup = connection.addConnectionListener((connected, state) => {
      setConnectionState(state as ConnectionState);
    });
    
    // Call once to set initial state
    setConnectionState(connection.getConnectionStatus() as ConnectionState);
    
    return cleanup;
  }, []);
  
  const reconnect = React.useCallback(() => {
    if (sessionId) {
      connect(sessionId);
    }
  }, [connect, sessionId]);
  
  const value = {
    isConnected: networkIsConnected,
    connectionState,
    reconnect,
    sessionId
  };
  
  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export const useNetworkStatus = () => useContext(NetworkStatusContext);

// Also provide the previous useNetwork for backward compatibility
export const useNetwork = useNetworkStatus;
