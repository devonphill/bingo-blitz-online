
import { useState, useEffect, useCallback } from 'react';
import { getWebSocketService } from '@/services/websocket/WebSocketService';
import { logWithTimestamp } from '@/utils/logUtils';
import { SessionStateUpdate } from '@/services/websocket/types';

interface UseSessionLifecycleProps {
  sessionId: string | null | undefined;
  onStateChange?: (state: SessionStateUpdate) => void;
}

export function useSessionLifecycle({ sessionId, onStateChange }: UseSessionLifecycleProps) {
  const [lifecycleState, setLifecycleState] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  
  // Track the session state
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`useSessionLifecycle: Setting up listener for session ${sessionId}`, 'info');
    
    const webSocketService = getWebSocketService();
    const unsubscribe = webSocketService.subscribeToSessionState(sessionId, (update) => {
      if (!update) return;
      
      // Update local state
      logWithTimestamp(`useSessionLifecycle: Session update - Status: ${update.status}, Lifecycle: ${update.lifecycle_state}`, 'info');
      setLifecycleState(update.lifecycle_state);
      setSessionStatus(update.status);
      
      // Determine if the game is active based on status and lifecycle state
      const gameIsActive = update.status === 'active' && update.lifecycle_state === 'live';
      setIsActive(gameIsActive);
      
      // Call the onStateChange callback if provided
      if (onStateChange) {
        onStateChange(update as SessionStateUpdate);
      }
    });
    
    // Clean up the subscription when unmounting
    return () => {
      logWithTimestamp(`useSessionLifecycle: Cleaning up listener for session ${sessionId}`, 'info');
      unsubscribe();
    };
  }, [sessionId, onStateChange]);
  
  // Method to manually transition state (for testing or forced updates)
  const transitionState = useCallback((newStatus: string, newLifecycleState: string) => {
    logWithTimestamp(`useSessionLifecycle: Manual transition - Status: ${newStatus}, Lifecycle: ${newLifecycleState}`, 'info');
    setSessionStatus(newStatus);
    setLifecycleState(newLifecycleState);
    setIsActive(newStatus === 'active' && newLifecycleState === 'live');
  }, []);
  
  return {
    lifecycleState,
    sessionStatus,
    isActive,
    transitionState
  };
}
