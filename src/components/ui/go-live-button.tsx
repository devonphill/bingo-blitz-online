
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
  children?: React.ReactNode;
}

export function GoLiveButton({ sessionId, className, onSuccess, disabled, children = "Go Live" }: GoLiveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { goLive, isUpdating } = useSessionLifecycle(sessionId);
  const { gameConfigs, isLoading: configsLoading } = useGameData(sessionId);

  const handleGoLive = async () => {
    setIsLoading(true);
    
    try {
      // First, check if we have game configs with active patterns
      let initialWinPattern = null;
      let currentGameType = 'mainstage';
      let initialPrize = '10.00'; // Default prize amount
      let initialPrizeDescription = 'One Line Prize'; // Default prize description
      
      if (gameConfigs && gameConfigs.length > 0) {
        const firstGameConfig = gameConfigs[0];
        currentGameType = firstGameConfig.gameType;
        
        // Add detailed logging to see the win patterns
        logWithTimestamp(`Going live - First game config: ${JSON.stringify(firstGameConfig)}`);
        
        if (firstGameConfig.patterns) {
          // Find first active pattern
          for (const [patternId, pattern] of Object.entries(firstGameConfig.patterns)) {
            if (pattern.active === true) {
              initialWinPattern = patternId;
              initialPrize = pattern.prizeAmount || '10.00';
              initialPrizeDescription = pattern.description || `${patternId} Prize`;
              logWithTimestamp(`Using initial win pattern: ${initialWinPattern}, Prize: ${initialPrize}, Description: ${initialPrizeDescription}`);
              break;
            }
          }
        }
      }
      
      // Ensure we have a valid pattern before proceeding
      if (!initialWinPattern) {
        logWithTimestamp("No active win pattern found in game configs, defaulting to oneLine");
        initialWinPattern = 'oneLine';
      }
      
      // ENHANCED: Double check the data we're about to save
      logWithTimestamp(`Updating sessions_progress with win pattern: ${initialWinPattern}, prize: ${initialPrize}, description: ${initialPrizeDescription}, game type: ${currentGameType}`);
      
      // First check if the session progress record exists
      const { data: existingProgress, error: checkError } = await supabase
        .from('sessions_progress')
        .select('id')
        .eq('session_id', sessionId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
        console.error("Error checking session progress:", checkError);
        throw new Error(`Failed to check session progress: ${checkError.message}`);
      }
      
      let progressResult;
      
      // If progress record exists, update it
      if (existingProgress) {
        // Update the existing progress record
        progressResult = await supabase
          .from('sessions_progress')
          .update({
            current_win_pattern: initialWinPattern,
            current_game_number: 1,
            current_game_type: currentGameType,
            game_status: 'active',
            current_prize: initialPrize,
            current_prize_description: initialPrizeDescription
          })
          .eq('session_id', sessionId)
          .select();
      } else {
        // Create a new progress record
        progressResult = await supabase
          .from('sessions_progress')
          .insert({
            session_id: sessionId,
            current_win_pattern: initialWinPattern,
            current_game_number: 1,
            max_game_number: 1,
            current_game_type: currentGameType,
            game_status: 'active',
            current_prize: initialPrize,
            current_prize_description: initialPrizeDescription
          })
          .select();
      }
      
      // Check for errors in the operation
      if (progressResult.error) {
        console.error("Error updating session progress:", progressResult.error);
        throw new Error(`Failed to update session progress: ${progressResult.error.message}`);
      }
      
      // Log the result of the update
      logWithTimestamp(`Update result: ${progressResult.data ? JSON.stringify(progressResult.data) : 'No data returned'}`);
      
      // ENHANCED: Verify the data was saved correctly
      const { data: verifyData, error: verifyError } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern, current_prize, current_prize_description')
        .eq('session_id', sessionId)
        .single();
        
      if (verifyError) {
        console.error("Error verifying session progress update:", verifyError);
      } else {
        logWithTimestamp(`Verification data: ${JSON.stringify(verifyData)}`);
        
        // If verification shows missing data, try once more
        if (!verifyData.current_prize || !verifyData.current_prize_description) {
          logWithTimestamp("Prize information missing, attempting one more update", 'warn');
          
          await supabase
            .from('sessions_progress')
            .update({
              current_prize: initialPrize,
              current_prize_description: initialPrizeDescription
            })
            .eq('session_id', sessionId);
        }
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
