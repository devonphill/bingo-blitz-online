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
  // 1. Derive sessionId and onStateChange with clear types.
  // These will be stable for the hook's instance unless props changes.
  const derivedSessionId: string | null | undefined =
    typeof props === 'string' || props === null || props === undefined
      ? props
      : props?.sessionId;

  const derivedOnStateChange =
    typeof props === 'object' && props !== null && props.onStateChange
      ? props.onStateChange
      : undefined;

  const [lifecycleState, setLifecycleState] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Track the session state
  useEffect(() => {
    // 2. Use the derivedSessionId in the effect.
    // The guard ensures it's a string when passed to functions.
    if (!derivedSessionId) return;

    // At this point, TypeScript knows derivedSessionId is a 'string'
    // due to the check above. We can assign it to a new const
    // to make it even clearer for TypeScript within this scope if needed,
    // but often the direct use after the guard is sufficient.
    const currentId = derivedSessionId;

    logWithTimestamp(`useSessionLifecycle: Setting up listener for session ${currentId}`, 'info');

    const webSocketService = getWebSocketService();
    // 3. Pass the narrowed 'currentId' (which is a string here)
    const unsubscribe = webSocketService.subscribeToSessionState(currentId, (update) => {
      if (!update) return;

      logWithTimestamp(`useSessionLifecycle: Session update - Status: ${update.status}, Lifecycle: ${update.lifecycle_state}`, 'info');
      setLifecycleState(update.lifecycle_state);
      setSessionStatus(update.status);

      const gameIsActive = update.status === 'active' && update.lifecycle_state === 'live';
      setIsActive(gameIsActive);

      if (derivedOnStateChange) {
        derivedOnStateChange(update as SessionStateUpdate);
      }
    });

    return () => {
      logWithTimestamp(`useSessionLifecycle: Cleaning up listener for session ${currentId}`, 'info');
      unsubscribe();
    };
    // 4. Use the derived values in the dependency array.
  }, [derivedSessionId, derivedOnStateChange]);

  // Method to manually transition state (for testing or forced updates)
  const transitionState = useCallback((newStatus: string, newLifecycleState: string) => {
    logWithTimestamp(`useSessionLifecycle: Manual transition - Status: ${newStatus}, Lifecycle: ${newLifecycleState}`, 'info');
    setSessionStatus(newStatus);
    setLifecycleState(newLifecycleState);
    setIsActive(newStatus === 'active' && newLifecycleState === 'live');
  }, []); // No problematic dependencies here

  // Method to set session to live state
  const goLive = useCallback(async () => {
    // 5. Use derivedSessionId in the callback.
    if (!derivedSessionId) {
      logWithTimestamp(`useSessionLifecycle: Cannot go live - No session ID`, 'error');
      return false;
    }

    // At this point, TypeScript knows derivedSessionId is a 'string'.
    const currentIdForUpdate = derivedSessionId;

    setIsUpdating(true);

    try {
      logWithTimestamp(`useSessionLifecycle: Setting session ${currentIdForUpdate} to live`, 'info');

      // 6. Pass the narrowed 'currentIdForUpdate' (string) to Supabase.
      const { error } = await supabase
        .from('game_sessions')
        .update({
          status: 'active',
          lifecycle_state: 'live',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentIdForUpdate); // Ensure this 'id' is definitely a string

      if (error) {
        throw new Error(`Failed to set session to live: ${error.message}`);
      }

      setSessionStatus('active');
      setLifecycleState('live');
      setIsActive(true);

      logWithTimestamp(`useSessionLifecycle: Session ${currentIdForUpdate} set to live successfully`, 'info');
      return true;
    } catch (error) {
      // It's good practice to type 'error' if you're accessing its properties.
      // For simple logging, 'any' or 'unknown' then checking 'instanceof Error' is common.
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`useSessionLifecycle: Error setting session to live: ${errorMessage}`, 'error');
      return false;
    } finally {
      setIsUpdating(false);
    }
    // 7. Use derivedSessionId in the dependency array.
  }, [derivedSessionId]);

  return {
    lifecycleState,
    sessionStatus,
    isActive,
    isUpdating,
    transitionState,
    goLive
  };
}
