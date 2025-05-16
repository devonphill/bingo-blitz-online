
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';

// Export type to fix TS1205 error
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

interface NetworkContextValue {
  isConnected: boolean;
  connectionState: ConnectionState;
  connectionTimestamp: number | null;
  sessionId: string | null; // Add sessionId property
  // Number called handlers
  addNumberCalledListener: (handler: (number: number, allNumbers: number[]) => void) => () => void;
  // Game state handlers
  addGameStateUpdateListener: (handler: (gameState: any) => void) => () => void;
  // Connection status listener
  addConnectionStatusListener: (handler: (isConnected: boolean) => void) => () => void; // Add this method
  // Presence events
  addPresenceListener: (handler: (action: 'join' | 'leave' | 'update', userId: string, data: any) => void) => () => void;
  // Connection management
  connect: (sessionId: string) => void;
  // Claim management
  submitBingoClaim: (ticket: any, playerCode: string, sessionId: string) => boolean;
  // Number calling
  callNumber: (number: number, sessionId?: string) => Promise<boolean>; // Add callNumber method
  // Player presence tracking
  updatePlayerPresence: (presenceData: any) => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export const NetworkProvider: React.FC<{
  sessionId?: string | null;
  children: React.ReactNode;
}> = ({ sessionId, children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionTimestamp, setConnectionTimestamp] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Get the singleton connection
  const connection = getSingleSourceConnection();

  // Connect to the session
  const connect = useCallback((sid: string) => {
    if (!sid) {
      logWithTimestamp('[NetworkProvider] No session ID provided for connect', 'warn');
      return;
    }

    logWithTimestamp(`[NetworkProvider] Explicitly connecting to session: ${sid}`, 'info');
    connection.connect(sid);
    setCurrentSessionId(sid);
  }, [connection]);

  // Connect to the session if provided in props
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp('[NetworkProvider] No session ID in props, skipping auto-connection', 'warn');
      return;
    }

    logWithTimestamp(`[NetworkProvider] Auto-connecting to session: ${sessionId}`, 'info');
    connection.connect(sessionId);
    setCurrentSessionId(sessionId);

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
    return connection.listenForEvent('GAME_STATE_UPDATE', handler);
  }, [connection]);

  // Add connection status listener
  const addConnectionStatusListener = useCallback((handler: (isConnected: boolean) => void) => {
    return connection.addConnectionListener(handler);
  }, [connection]);

  // Add presence listener
  const addPresenceListener = useCallback((handler: (action: 'join' | 'leave' | 'update', userId: string, data: any) => void) => {
    // This is a placeholder for now - we'll need to implement presence functionality
    return () => {};
  }, []);

  // Submit bingo claim
  const submitBingoClaim = useCallback((ticket: any, playerCode: string, sessionId: string) => {
    if (!ticket || !playerCode || !sessionId) {
      logWithTimestamp('[NetworkProvider] Cannot submit claim: Missing ticket, player code, or session ID', 'error');
      return false;
    }
    
    logWithTimestamp(`[NetworkProvider] Submitting bingo claim for session: ${sessionId}`, 'info');
    return connection.submitBingoClaim(ticket, playerCode, sessionId);
  }, [connection]);

  // Call number 
  const callNumber = useCallback(async (number: number, sessionId?: string): Promise<boolean> => {
    return connection.callNumber(number, sessionId);
  }, [connection]);

  // Update player presence
  const updatePlayerPresence = useCallback(async (presenceData: any) => {
    if (!presenceData) {
      logWithTimestamp('[NetworkProvider] Cannot update presence: No presence data', 'error');
      return false;
    }
    
    try {
      logWithTimestamp('[NetworkProvider] Updating player presence', 'info');
      // Placeholder for now - will implement actual presence
      return true;
    } catch (error) {
      logWithTimestamp(`[NetworkProvider] Error updating player presence: ${error}`, 'error');
      return false;
    }
  }, []);

  const value: NetworkContextValue = {
    isConnected,
    connectionState,
    connectionTimestamp,
    sessionId: currentSessionId,
    addNumberCalledListener,
    addGameStateUpdateListener,
    addConnectionStatusListener, 
    addPresenceListener,
    connect,
    submitBingoClaim,
    callNumber,
    updatePlayerPresence
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

// Use export type to avoid conflicts
export { NetworkContext };
