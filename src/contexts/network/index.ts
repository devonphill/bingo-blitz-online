
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSingleSourceConnection, CHANNEL_NAMES, EVENT_TYPES } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

interface NetworkContextValue {
  isConnected: boolean;
  connectionState: ConnectionState;
  connectionTimestamp: number | null;
  // Number called handlers
  addNumberCalledListener: (handler: (number: number, allNumbers: number[]) => void) => () => void;
  // Game state handlers
  addGameStateUpdateListener: (handler: (gameState: any) => void) => () => void;
  // Presence events
  addPresenceListener: (handler: (action: 'join' | 'leave' | 'update', userId: string, data: any) => void) => () => void;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export const NetworkProvider: React.FC<{
  sessionId?: string | null;
  children: React.ReactNode;
}> = ({ sessionId, children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionTimestamp, setConnectionTimestamp] = useState<number | null>(null);

  // Get the singleton connection
  const connection = getSingleSourceConnection();

  // Connect to the session
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('[NetworkProvider] No session ID, skipping connection', 'warn');
      return;
    }

    logWithTimestamp(`[NetworkProvider] Connecting to session: ${sessionId}`, 'info');
    connection.connect(sessionId);

    // Set up connection status listener
    const cleanup = connection.addConnectionListener((connected) => {
      logWithTimestamp(`[NetworkProvider] Connection status changed: ${connected}`, 'info');
      setIsConnected(connected);
      setConnectionState(connected ? 'connected' : 'disconnected');
      if (connected) {
        setConnectionTimestamp(Date.now());
      }
    });

    // Initial connection state
    setIsConnected(connection.isConnected());
    setConnectionState(connection.isConnected() ? 'connected' : 'disconnected');

    // Cleanup on unmount or session ID change
    return cleanup;
  }, [sessionId, connection]);

  // Add number called listener
  const addNumberCalledListener = useCallback((handler: (number: number, allNumbers: number[]) => void) => {
    return connection.onNumberCalled(handler);
  }, [connection]);

  // Add game state update listener
  const addGameStateUpdateListener = useCallback((handler: (gameState: any) => void) => {
    return connection.listenForEvent(EVENT_TYPES.GAME_STATE_UPDATE, handler);
  }, [connection]);

  // Add presence listener
  const addPresenceListener = useCallback((handler: (action: 'join' | 'leave' | 'update', userId: string, data: any) => void) => {
    // This is a placeholder for now - we'll need to implement presence functionality
    return () => {};
  }, []);

  const value: NetworkContextValue = {
    isConnected,
    connectionState,
    connectionTimestamp,
    addNumberCalledListener,
    addGameStateUpdateListener,
    addPresenceListener,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export { ConnectionState };
