
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export interface SessionStateUpdate {
  sessionId: string;
  state: string;
}

export interface UseSessionLifecycleProps {
  sessionId: string | null | undefined;
  onStateChange?: (state: SessionStateUpdate) => void;
}

// Update the type definition to accept either a props object or a string/null/undefined
export function useSessionLifecycle(props: UseSessionLifecycleProps | string | null | undefined) {
  // Handle both string and object props with proper type guards
  const sessionId = typeof props === 'string' || props === null || props === undefined
    ? props 
    : props.sessionId;
     
  const onStateChange = typeof props === 'object' && props !== null
    ? props.onStateChange
    : undefined;
   
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleState, setLifecycleState] = useState<string | null>(null);

  // Fetch the current lifecycle state when sessionId changes
  useEffect(() => {
    if (!sessionId) return;

    async function fetchLifecycleState() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('lifecycle_state')
          .eq('id', sessionId)
          .single();

        if (error) throw error;
        if (data) {
          setLifecycleState(data.lifecycle_state);
          logWithTimestamp(`Fetched lifecycle state: ${data.lifecycle_state}`, 'info');
        }
      } catch (err) {
        console.error('Error fetching lifecycle state:', err);
        setError('Failed to fetch session state');
      }
    }

    fetchLifecycleState();
    
    // Safe check for string type before setup subscription
    if (typeof sessionId === 'string') {
      // Set up a real-time subscription for lifecycle state changes
      const channel = supabase
        .channel(`session-lifecycle-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const newState = payload.new.lifecycle_state;
            setLifecycleState(newState);
            logWithTimestamp(`Real-time lifecycle state update: ${newState}`, 'info');
            
            // Call the callback if provided
            if (onStateChange) {
              onStateChange({
                sessionId,
                state: newState,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [sessionId, onStateChange]);

  // Function to transition a session to a new lifecycle state
  const transitionToState = useCallback(
    async (newState: string) => {
      if (!sessionId || typeof sessionId !== 'string') {
        setError('No session ID provided');
        return false;
      }

      setIsUpdating(true);
      setError(null);
      
      try {
        logWithTimestamp(`Transitioning session ${sessionId} to state: ${newState}`, 'info');
        
        const { error } = await supabase
          .from('sessions')
          .update({ lifecycle_state: newState })
          .eq('id', sessionId);

        if (error) throw error;
        
        setLifecycleState(newState);
        logWithTimestamp(`Session transitioned to ${newState}`, 'success');
        return true;
      } catch (err) {
        console.error('Error transitioning session state:', err);
        setError('Failed to update session state');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [sessionId]
  );

  return {
    lifecycleState,
    isUpdating,
    error,
    transitionToState,
  };
}
