
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useClaimManagement(sessionId: string | undefined, gameNumber: number | undefined) {
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  const validateClaim = useCallback(async (
    playerId: string, 
    playerName: string,
    winPatternId: string,
    currentCalledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: {
      serial: string;
      perm: number;
      position: number;
      layoutMask: number;
      numbers: number[];
    }
  ) => {
    if (!sessionId || !gameNumber) return false;

    setIsProcessingClaim(true);
    try {
      // Save the validation record directly to universal_game_logs
      const { error: logError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          game_number: gameNumber,
          player_id: playerId,
          player_name: playerName,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask,
          ticket_numbers: ticketData.numbers,
          win_pattern: winPatternId,
          called_numbers: currentCalledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: currentCalledNumbers.length,
          validated_at: new Date().toISOString(),
          game_type: 'mainstage' // Default game type if not available
        });

      if (logError) {
        console.error("Error logging claim validation:", logError);
        toast({
          title: "Error",
          description: "Failed to validate claim.",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Claim Validated",
        description: "The claim has been successfully validated.",
      });
      return true;
    } catch (err) {
      console.error("Error in validateClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while validating the claim.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, gameNumber, toast]);

  const rejectClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPatternId: string,
    currentCalledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: {
      serial: string;
      perm: number;
      position: number;
      layoutMask: number;
      numbers: number[];
    }
  ) => {
    if (!sessionId || !gameNumber) return false;

    setIsProcessingClaim(true);
    try {
      // Log the rejected claim in universal_game_logs
      const { error: logError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          game_number: gameNumber,
          player_id: playerId,
          player_name: playerName,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask,
          ticket_numbers: ticketData.numbers,
          win_pattern: winPatternId,
          called_numbers: currentCalledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: currentCalledNumbers.length,
          validated_at: new Date().toISOString(),
          game_type: 'mainstage' // Default game type if not available
        });

      if (logError) {
        console.error("Error logging claim rejection:", logError);
        toast({
          title: "Error",
          description: "Failed to reject claim.",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Claim Rejected",
        description: "The claim has been successfully rejected.",
      });
      return true;
    } catch (err) {
      console.error("Error in rejectClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while rejecting the claim.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, gameNumber, toast]);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
