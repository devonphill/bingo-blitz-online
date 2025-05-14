import { useState, useEffect, useCallback } from 'react';
import { getWebSocketService } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';
import { SessionStateUpdate } from '@/services/websocket/types';
import { supabase } from '@/integrations/supabase/client';

export interface UseSessionLifecycleProps {
  sessionId: string | null | undefined;
  onStateChange?: (state: SessionStateUpdate) => void;
}

export function useSessionLifecycle(props: UseSessionLifecycleProps | string | null | undefined) {
  // Handle both string and object props
  const sessionId: string | null | undefined = typeof props === 'string' || props === null || props === undefined
    ? props
    : props.sessionId;
    
  const onStateChange: ((state: SessionStateUpdate) => void) | undefined = typeof props === 'object' && props !== null
    ? props.onStateChange
    : undefined;
  
  const [lifecycleState, setLifecycleState] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUpdating, setIsUpdating(false);
  
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
  
  // Method to set session to live state
  const goLive = useCallback(async () => {
    if (!sessionId) {
      logWithTimestamp(`useSessionLifecycle: Cannot go live - No session ID`, 'error');
      return false;
    }
    
    setIsUpdating(true);
    
    try {
      logWithTimestamp(`useSessionLifecycle: Setting session ${sessionId} to live`, 'info');
      
      // Update the session in the database
      const { error } = await supabase
        .from('game_sessions')
        .update({
          status: 'active',
          lifecycle_state: 'live',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (error) {
        throw new Error(`Failed to set session to live: ${error.message}`);
      }
      
      // Update local state
      setSessionStatus('active');
      setLifecycleState('live');
      setIsActive(true);
      
      logWithTimestamp(`useSessionLifecycle: Session ${sessionId} set to live successfully`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`useSessionLifecycle: Error setting session to live: ${error}`, 'error');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [sessionId]);
  
  return {
    lifecycleState,
    sessionStatus,
    isActive,
    isUpdating,
    transitionState,
    goLive
  };
}
