
import React, { createContext, useContext } from 'react';
import { useNetworkContext, ConnectionState } from './network';

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
  const { isConnected, sessionId, connect } = useNetworkContext();
  
  const reconnect = React.useCallback(() => {
    if (sessionId) {
      connect(sessionId);
    }
  }, [connect, sessionId]);
  
  const value = {
    isConnected,
    connectionState: isConnected ? 'connected' : 'disconnected',
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
