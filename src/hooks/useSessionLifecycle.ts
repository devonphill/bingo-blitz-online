
import { useState, useEffect, useCallback, useRef } from 'react';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { logWithTimestamp } from '@/utils/logUtils';
import { SessionStateUpdate } from '@/services/websocket/types';
import { supabase } from '@/integrations/supabase/client';

export interface UseSessionLifecycleProps {
  sessionId: string | null | undefined;
  onStateChange?: (state: SessionStateUpdate) => void;
}

export function useSessionLifecycle(props: UseSessionLifecycleProps): {
  lifecycleState: string | null;
  sessionStatus: string | null;
  isActive: boolean;
  isUpdating: boolean;
  transitionState: (newStatus: string, newLifecycleState: string) => void;
  goLive: () => Promise<boolean>;
} {
  // 1. Derive sessionId and onStateChange with clear types.
  const sessionId = typeof props === 'object' && props !== null ? props.sessionId : null;
  const onStateChange = typeof props === 'object' && props !== null ? props.onStateChange : undefined;

  const [lifecycleState, setLifecycleState] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const webSocketService = useRef(getWebSocketService());

  // Track the session state
  useEffect(() => {
    if (!sessionId) return;

    const currentId = sessionId;

    logWithTimestamp(`useSessionLifecycle: Setting up listener for session ${currentId}`, 'info');

    // Enhanced subscription to broadcast state changes more reliably
    const unsubscribe = webSocketService.current.subscribeToSessionState(currentId, (update) => {
      if (!update) return;

      logWithTimestamp(`useSessionLifecycle: Session update - Status: ${update.status}, Lifecycle: ${update.lifecycle_state}`, 'info');
      setLifecycleState(update.lifecycle_state);
      setSessionStatus(update.status);

      const gameIsActive = update.status === 'active' && update.lifecycle_state === 'live';
      setIsActive(gameIsActive);

      if (onStateChange) {
        onStateChange(update as SessionStateUpdate);
      }
      
      // Broadcast the state change to all listeners for this session
      // This ensures all components get notified of state changes
      webSocketService.current.broadcast(CHANNEL_NAMES.SESSION_UPDATES, {
        type: EVENT_TYPES.SESSION_STATE_CHANGE,
        sessionId: currentId,
        status: update.status,
        lifecycleState: update.lifecycle_state,
        isActive: gameIsActive,
        timestamp: new Date().toISOString()
      });
    });

    return () => {
      logWithTimestamp(`useSessionLifecycle: Cleaning up listener for session ${currentId}`, 'info');
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

    const currentIdForUpdate = sessionId;
    setIsUpdating(true);

    try {
      logWithTimestamp(`useSessionLifecycle: Setting session ${currentIdForUpdate} to live`, 'info');

      // Update database state
      const { error } = await supabase
        .from('game_sessions')
        .update({
          status: 'active',
          lifecycle_state: 'live',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentIdForUpdate);

      if (error) {
        throw new Error(`Failed to set session to live: ${error.message}`);
      }

      setSessionStatus('active');
      setLifecycleState('live');
      setIsActive(true);

      // Enhanced notification - directly broadcast after successful DB update
      webSocketService.current.broadcastWithRetry(
        CHANNEL_NAMES.SESSION_UPDATES,
        EVENT_TYPES.GO_LIVE,
        {
          sessionId: currentIdForUpdate,
          status: 'active',
          lifecycleState: 'live',
          isActive: true,
          timestamp: new Date().toISOString()
        }
      );

      logWithTimestamp(`useSessionLifecycle: Session ${currentIdForUpdate} set to live successfully and broadcast sent`, 'info');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`useSessionLifecycle: Error setting session to live: ${errorMessage}`, 'error');
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
