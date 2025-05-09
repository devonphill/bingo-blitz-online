
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { resolvePlayerId, upsertClaimInDatabase } from '@/services/PlayerClaimUtils';
import { useClaimBroadcaster } from './useClaimBroadcaster';

/**
 * Hook for handling claim validation logic
 */
export function useClaimValidator(sessionId?: string, gameNumber?: number) {
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();
  const { broadcastClaimResult } = useClaimBroadcaster();

  /**
   * Common claim processing logic used by both validate and reject
   */
  const processClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPattern: string,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: any,
    isValid: boolean
  ) => {
    if (!sessionId) {
      toast({
        title: "Error",
        description: "No active session found",
        variant: "destructive"
      });
      return false;
    }

    setIsProcessingClaim(true);
    try {
      logWithTimestamp(`${isValid ? 'Validating' : 'Rejecting'} claim for player ${playerName || playerId}, pattern: ${winPattern}`);
      
      // Resolve player ID if it's a player code
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
      
      // Update or insert the claim in the database
      const dbResult = await upsertClaimInDatabase(
        sessionId,
        actualPlayerId,
        effectivePlayerName,
        winPattern,
        calledNumbers,
        lastCalledNumber,
        ticketData,
        gameNumber || 1,
        'mainstage',
        isValid
      );
      
      if (!dbResult) {
        toast({
          title: "Error",
          description: `Failed to ${isValid ? 'validate' : 'reject'} claim in database`,
          variant: "destructive"
        });
        return false;
      }

      // Broadcast the result to the player
      await broadcastClaimResult(
        playerId, 
        actualPlayerId, 
        isValid ? 'valid' : 'rejected'
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
  }, [sessionId, gameNumber, toast, broadcastClaimResult]);

  // Function to validate a claim
  const validateClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPattern: string,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: any
  ) => {
    return processClaim(
      playerId, 
      playerName, 
      winPattern, 
      calledNumbers, 
      lastCalledNumber, 
      ticketData, 
      true // isValid = true
    );
  }, [processClaim]);

  // Function to reject a claim
  const rejectClaim = useCallback(async (
    playerId: string,
    playerName: string,
    winPattern: string,
    calledNumbers: number[],
    lastCalledNumber: number | null,
    ticketData: any
  ) => {
    return processClaim(
      playerId, 
      playerName, 
      winPattern, 
      calledNumbers, 
      lastCalledNumber, 
      ticketData, 
      false // isValid = false
    );
  }, [processClaim]);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
