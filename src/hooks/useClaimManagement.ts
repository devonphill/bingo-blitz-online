import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { parseClaimIdForDb } from '@/utils/claimTypeUtils';
import { ClaimData } from '@/types/claim';
import { claimBroadcastService } from '@/services/ClaimBroadcastService';

/**
 * Main hook for claim management, using direct database interactions
 */
export function useClaimManagement(sessionId?: string, gameNumber?: number) {
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  /**
   * Validate or reject a claim
   */
  const validateClaim = useCallback(async (claim: ClaimData, isValid: boolean): Promise<boolean> => {
    if (!claim || !sessionId) {
      logWithTimestamp('Cannot validate claim: Missing claim data or session ID', 'error');
      return false;
    }

    setIsProcessingClaim(true);

    try {
      logWithTimestamp(`Validating claim ${claim.id} as ${isValid ? 'valid' : 'rejected'}`, 'info');
      
      // Use the claim ID as a string UUID
      const dbClaimId = parseClaimIdForDb(claim.id);
      
      // Update claim status in database
      const { error } = await supabase
        .from('claims')
        .update({
          status: isValid ? 'verified' : 'rejected',
          verified_at: new Date().toISOString()
        })
        .eq('id', dbClaimId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Broadcast result to players
      await claimBroadcastService.broadcastClaimResult({
        sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'Player',
        result: isValid ? 'valid' : 'rejected',
        ticket: claim.ticket,
        timestamp: new Date().toISOString()
      });

      logWithTimestamp(`Claim ${claim.id} validation complete: ${isValid ? 'valid' : 'rejected'}`, 'info');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp(`Error validating claim: ${errorMessage}`, 'error');
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, toast]);

  /**
   * Reject a claim (convenience wrapper)
   */
  const rejectClaim = useCallback(async (claim: ClaimData): Promise<boolean> => {
    return validateClaim(claim, false);
  }, [validateClaim]);

  return {
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
