
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useSessionPatternManager } from '@/hooks/useSessionPatternManager';
import { validateChannelType } from '@/utils/typeUtils';

interface GoLiveButtonProps {
  sessionId: string;
  disabled?: boolean;
  isLive?: boolean;
  callback?: () => void;
}

export default function GoLiveButton({ sessionId, disabled = false, isLive = false, callback }: GoLiveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { initializeSessionPattern } = useSessionPatternManager(sessionId);

  const handleGoLive = async () => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No session ID provided",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      logWithTimestamp(`GoLiveButton: Setting session ${sessionId} to go live`, 'info');
      
      // First, make sure we have a win pattern and prize info set
      const patternInitialized = await initializeSessionPattern();
      if (!patternInitialized) {
        logWithTimestamp(`GoLiveButton: Failed to initialize win pattern`, 'warn');
        toast({
          title: "Warning",
          description: "Could not set initial win pattern",
          variant: "destructive"
        });
      }
      
      // Update the game_sessions table to set the session to active
      const { error: updateError } = await supabase
        .from('game_sessions')
        .update({
          status: 'active',
          lifecycle_state: 'live',
        })
        .eq('id', sessionId);
      
      if (updateError) {
        throw updateError;
      }
      
      // Update the sessions_progress table to set game_status to active
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          game_status: 'active'
        })
        .eq('session_id', sessionId);
      
      if (progressError) {
        console.error("Error updating session progress:", progressError);
      }
      
      // Verify both updates were successful
      const { data: sessionData, error: verifyError } = await supabase
        .from('game_sessions')
        .select('status, lifecycle_state')
        .eq('id', sessionId)
        .single();
        
      if (verifyError) {
        throw verifyError;
      }
      
      if (sessionData.status !== 'active' || sessionData.lifecycle_state !== 'live') {
        throw new Error("Session state not updated correctly");
      }
      
      // Double check the sessions_progress table was updated
      const { data: progressData } = await supabase
        .from('sessions_progress')
        .select('game_status, current_win_pattern, current_prize')
        .eq('session_id', sessionId)
        .single();
        
      if (!progressData || progressData.game_status !== 'active') {
        logWithTimestamp(`GoLiveButton: Session progress not updated correctly`, 'warn');
      }
      
      if (!progressData?.current_win_pattern) {
        logWithTimestamp(`GoLiveButton: No win pattern set in session progress`, 'warn');
        
        // Try one more time to set the initial win pattern
        await initializeSessionPattern();
      }
      
      // Broadcast that the session is now live
      const channel = supabase.channel('session-updates');
      await channel.send({
        type: validateChannelType('broadcast'),
        event: 'session-live',
        payload: {
          sessionId,
          timestamp: new Date().toISOString()
        }
      });
      
      toast({
        title: "Success",
        description: "Game is now live! Players can join.",
        duration: 3000
      });
      
      logWithTimestamp(`GoLiveButton: Session ${sessionId} set to live successfully`, 'info');
      
      // Call the callback if provided
      if (callback) {
        callback();
      }
    } catch (error) {
      console.error('Error setting session to live:', error);
      toast({
        title: "Error",
        description: "Failed to set game to live state",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      size="lg"
      className={`w-full ${isLive ? 'bg-green-600 hover:bg-green-700' : 'bg-bingo-primary hover:bg-bingo-secondary'}`}
      onClick={handleGoLive}
      disabled={disabled || isLoading || isLive}
    >
      {isLoading ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
          <span>Going Live...</span>
        </>
      ) : isLive ? (
        <>
          <span>Game is Live</span>
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          <span>Go Live</span>
        </>
      )}
    </Button>
  );
}
