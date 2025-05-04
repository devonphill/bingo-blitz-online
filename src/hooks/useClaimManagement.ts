
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
    if (!sessionId || !gameNumber) {
      console.error("Missing sessionId or gameNumber in validateClaim:", { sessionId, gameNumber });
      toast({
        title: "Validation Error",
        description: "Missing session or game data.",
        variant: "destructive"
      });
      return false;
    }

    setIsProcessingClaim(true);
    
    console.log("Validating claim with data:", {
      sessionId,
      gameNumber,
      playerId,
      playerName,
      winPatternId,
      calledNumbersCount: currentCalledNumbers.length,
      ticketSerial: ticketData.serial,
      ticketPerm: ticketData.perm
    });
    
    try {
      // Check if playerId looks like a UUID or a player code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);

      // Save the validation record directly to universal_game_logs
      const { error: logError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          game_number: gameNumber,
          // Store the playerId as is - don't try to convert it to UUID if it's not
          player_id: isUuid ? playerId : null, 
          // Always store the player code in player_name field if it's not a UUID
          player_name: isUuid ? playerName : playerId,
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
          description: "Failed to validate claim: " + logError.message,
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Claim Validated",
        description: "Your claim has been successfully validated.",
      });
      
      console.log("Claim validation successful");
      return true;
    } catch (err: any) {
      console.error("Error in validateClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred: " + (err.message || "Unknown error"),
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
    if (!sessionId || !gameNumber) {
      console.error("Missing sessionId or gameNumber in rejectClaim:", { sessionId, gameNumber });
      return false;
    }

    setIsProcessingClaim(true);
    try {
      console.log("Rejecting claim with data:", {
        sessionId,
        gameNumber,
        playerId,
        playerName,
        ticketSerial: ticketData.serial
      });
      
      // Check if playerId looks like a UUID or a player code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);
      
      // Log the rejected claim in universal_game_logs
      const { error: logError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          game_number: gameNumber,
          // Store the playerId as is - don't try to convert it to UUID if it's not
          player_id: isUuid ? playerId : null,
          // Always store the player code in player_name field if it's not a UUID
          player_name: isUuid ? playerName : playerId,
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
          description: "Failed to reject claim: " + logError.message,
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "Claim Rejected",
        description: "The claim has been rejected.",
      });
      
      console.log("Claim rejection successful");
      return true;
    } catch (err: any) {
      console.error("Error in rejectClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred: " + (err.message || "Unknown error"),
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
