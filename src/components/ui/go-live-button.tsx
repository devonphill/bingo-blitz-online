
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGameData } from '@/hooks/useGameData';
import { logWithTimestamp } from '@/utils/logUtils';

interface GoLiveButtonProps {
  sessionId: string;
  className?: string;
  onSuccess?: () => void;
  disabled?: boolean;
  children?: React.ReactNode; // Added this line to accept children
}

export function GoLiveButton({ sessionId, className, onSuccess, disabled, children = "Go Live" }: GoLiveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { goLive, isUpdating } = useSessionLifecycle(sessionId);
  const { gameConfigs, isLoading: configsLoading } = useGameData(sessionId);

  const handleGoLive = async () => {
    setIsLoading(true);
    
    try {
      // First, check if we have game configs with active patterns
      let initialWinPattern = 'oneLine'; // Default
      let currentGameType = 'mainstage';
      
      if (gameConfigs && gameConfigs.length > 0) {
        const firstGameConfig = gameConfigs[0];
        currentGameType = firstGameConfig.gameType;
        
        if (firstGameConfig.patterns) {
          // Find first active pattern
          for (const [patternId, pattern] of Object.entries(firstGameConfig.patterns)) {
            if (pattern.active === true) {
              initialWinPattern = patternId;
              logWithTimestamp(`Using initial win pattern: ${initialWinPattern}`);
              break;
            }
          }
        }
      }
      
      // Start by updating the sessions_progress table with the initial win pattern
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: initialWinPattern,
          current_game_number: 1,
          current_game_type: currentGameType,
          game_status: 'active'
        })
        .eq('session_id', sessionId);
      
      if (progressError) {
        console.error("Error updating session progress:", progressError);
        throw new Error(`Failed to update session progress: ${progressError.message}`);
      }
      
      // Now call the regular goLive function
      const success = await goLive();
      
      if (success) {
        toast({
          title: "Session is now live",
          description: `Players can now join and play. Initial pattern: ${initialWinPattern}`,
          duration: 3000
        });
        
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Error going live:", error);
      toast({
        title: "Error",
        description: "Failed to go live. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleGoLive}
      className={className}
      disabled={isLoading || isUpdating || disabled || configsLoading}
    >
      {(isLoading || isUpdating) ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Going Live...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
