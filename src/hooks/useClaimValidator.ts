
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { resolvePlayerId } from '@/services/PlayerClaimUtils';
import { useClaimBroadcaster } from './useClaimBroadcaster';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for handling claim validation logic
 */
export function useClaimValidator(sessionId?: string, gameNumber?: number, sessionName?: string) {
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();
  const { broadcastClaimResult } = useClaimBroadcaster();

  /**
   * Common claim processing logic used by both validate and reject
   */
  const processClaim = useCallback(async (
    claim: any,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    isValid: boolean
  ) => {
    if (!sessionId || !claim?.id) {
      toast({
        title: "Error",
        description: "No active session or claim found",
        variant: "destructive"
      });
      return false;
    }

    setIsProcessingClaim(true);
    try {
      const validationStatus = isValid ? 'VALID' : 'INVALID';
      logWithTimestamp(`${isValid ? 'Validating' : 'Rejecting'} claim for player ${claim.playerName || claim.playerId}, pattern: ${claim.winPattern || claim.pattern_claimed}`);
      
      // Extract required data from claim
      const playerId = claim.playerId || claim.player_id;
      const playerName = claim.playerName || claim.player_name || 'Unknown Player';
      const playerCode = claim.playerCode || claim.player_code;
      const winPattern = claim.winPattern || claim.pattern_claimed || '';
      const claimId = claim.id;
      
      // Resolve player ID if needed
      const { actualPlayerId, playerName: resolvedPlayerName, error } = await resolvePlayerId(playerId);
      
      if (error) {
        toast({
          title: "Error",
          description: `Failed to resolve player: ${error}`,
          variant: "destructive"
        });
        return false;
      }
      
      // Use the resolved player name if available
      const effectivePlayerName = resolvedPlayerName || playerName;

      // Prepare ticket details
      const ticketDetails = claim.ticket || claim.ticket_details || {};
      
      // Prepare log entry for universal_game_logs as a Record<string, any> to avoid type issues
      const logEntry: Record<string, any> = {
        validation_status: validationStatus,
        win_pattern: winPattern,
        session_uuid: sessionId,
        session_name: sessionName || 'Unknown Session',
        player_id: playerCode, // This is now a text field for player code
        player_uuid: actualPlayerId, // UUID reference to player
        player_name: effectivePlayerName,
        game_type: claim.gameType || 'mainstage',
        game_number: gameNumber || 1,
        called_numbers: calledNumbers || [],
        last_called_number: lastCalledNumber,
        total_calls: calledNumbers?.length || 0,
        claimed_at: claim.claimed_at || claim.timestamp || new Date().toISOString(),
        
        // Ticket details wrapped in arrays for new schema
        ticket_serial: [ticketDetails.serial || claim.ticketSerial || ''], 
        ticket_perm: [ticketDetails.perm || 0],
        ticket_layout_mask: [ticketDetails.layoutMask || ticketDetails.layout_mask || 0],
        ticket_position: [ticketDetails.position || 0]
      };
      
      // Add ticket_numbers as JSON
      if (ticketDetails.numbers) {
        logEntry.ticket_numbers = JSON.stringify(ticketDetails.numbers);
      }
      
      // Additional fields if available
      if (claim.prize) {
        logEntry.prize = claim.prize;
      }
      
      if (claim.prizeAmount) {
        logEntry.prize_amount = claim.prizeAmount;
      }
      
      // Log the attempt
      console.log('[CallerAction] Attempting to insert into universal_game_logs:', logEntry);
      
      // Insert into universal_game_logs
      const { data: logData, error: logError } = await supabase
        .from('universal_game_logs')
        .insert(logEntry)
        .select();
        
      if (logError) {
        console.error('[DB Log Error] Failed to insert into universal_game_logs:', logError, 'Payload:', logEntry);
        toast({
          title: "Database Error",
          description: "Failed to log validation result. Please try again.",
          variant: "destructive"
        });
        return false;
      }
      
      console.log('[DB Log Success] Logged to universal_game_logs:', logData);
      
      // Delete from claims queue
      console.log('[CallerAction] Attempting to delete from claims queue, ID:', claimId);
      
      const { error: deleteError } = await supabase
        .from('claims')
        .delete()
        .match({ id: claimId });
        
      if (deleteError) {
        console.error('[DB Delete Error] Failed to delete from claims table:', deleteError, 'ID:', claimId);
        toast({
          title: "Warning",
          description: "Validation recorded but failed to remove from queue",
          variant: "default" // Fixed: Changed from "warning" to "default"
        });
      } else {
        console.log('[DB Delete Success] Claim deleted from claims queue:', claimId);
      }

      // Prepare broadcast payload for the player
      const broadcastPayload = {
        claimId: claimId,
        playerId: playerId,
        playerName: effectivePlayerName,
        validationStatus: validationStatus,
        ticketSerial: ticketDetails.serial || '',
        patternClaimed: winPattern,
        timestamp: new Date().toISOString()
      };
      
      // Broadcast result to the player
      await broadcastClaimResult(
        playerId, 
        actualPlayerId, 
        isValid ? 'valid' : 'rejected',
        broadcastPayload  // Pass additional data for enhanced player notification
      );

      toast({
        title: isValid ? "Claim Validated" : "Claim Rejected",
        description: isValid 
          ? "The claim has been validated successfully" 
          : "The claim has been rejected"
      });

      return true;
    } catch (err) {
      console.error(`Error ${isValid ? 'validating' : 'rejecting'} claim:`, err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, gameNumber, sessionName, toast, broadcastClaimResult]);

  // Function to validate a claim
  const validateClaim = useCallback(async (claim: any, calledNumbers: number[], lastCalledNumber: number | null) => {
    return processClaim(claim, calledNumbers, lastCalledNumber, true); // isValid = true
  }, [processClaim]);

  // Function to reject a claim
  const rejectClaim = useCallback(async (claim: any, calledNumbers: number[], lastCalledNumber: number | null) => {
    return processClaim(claim, calledNumbers, lastCalledNumber, false); // isValid = false
  }, [processClaim]);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
