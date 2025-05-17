import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { useNetworkContext } from '@/contexts/network';
import { getNCMInstance } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { logWithTimestamp } from '@/utils/logUtils';

export function usePlayerGame(sessionId: string | null, playerCode: string | null) {
  // Use both contexts for backwards compatibility during refactoring
  const networkStatus = useNetworkStatus();
  const networkContext = useNetworkContext();
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [playerData, setPlayerData] = useState<any>(null);
  
  // Get direct reference to connection
  const connection = getNCMInstance();
  
  // Update presence periodically
  useEffect(() => {
    if (!sessionId || !playerCode) return;
    
    const interval = setInterval(() => {
      // Use networkContext for now, but in future this can be moved to a direct call
      if (networkContext.updatePlayerPresence) {
        networkContext.updatePlayerPresence(sessionId, {
          code: playerCode,
          last_seen: new Date().toISOString()
        }).then(() => {
          setLastUpdate(new Date());
        });
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, playerCode, networkContext]);
  
  // Connect to session
  useEffect(() => {
    if (!sessionId) return;
    
    // Use SingleSourceTrueConnections directly in future 
    // For now use reconnect from NetworkStatusContext
    networkStatus.reconnect();
    
    // Set up connection listener
    const cleanup = connection.addConnectionListener((connected) => {
      setIsConnected(connected);
    });
    
    // Call once to set initial state
    setIsConnected(connection.isConnected());
    
    return cleanup;
  }, [sessionId, networkStatus, connection]);
  
  // Submit a claim
  const submitClaim = useCallback((ticket: any) => {
    if (!sessionId || !playerCode || !isConnected) return false;
    
    logWithTimestamp(`Submitting claim for player ${playerCode} in session ${sessionId}`, 'info');
    
    // Use networkContext for backwards compatibility
    return networkContext.submitBingoClaim(ticket, playerCode, sessionId);
  }, [sessionId, playerCode, isConnected, networkContext]);
  
  return {
    isConnected,
    lastUpdate,
    playerData,
    submitClaim
  };
}
