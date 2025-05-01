
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type SessionLifecycleState = 'setup' | 'live' | 'ended';

export function useSessionLifecycle(sessionId: string | undefined) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const setSessionLifecycle = async (state: SessionLifecycleState): Promise<boolean> => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No session ID provided",
        variant: "destructive"
      });
      return false;
    }

    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ lifecycle_state: state })
        .eq('id', sessionId);

      if (error) {
        console.error("Error updating session lifecycle state:", error);
        toast({
          title: "Error",
          description: `Failed to update session to ${state} state`,
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Success",
        description: `Session updated to ${state} state`,
      });
      
      return true;
    } catch (err) {
      console.error("Exception updating session lifecycle:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const goLive = async (): Promise<boolean> => {
    return await setSessionLifecycle('live');
  };

  const endSession = async (): Promise<boolean> => {
    return await setSessionLifecycle('ended');
  };

  return {
    isUpdating,
    setSessionLifecycle,
    goLive,
    endSession
  };
}
