
import { useState, useEffect, useCallback } from 'react';
import { claimService, BingoClaim } from '@/services/ClaimManagementService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Listen for claims in this session
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up claim listener for session ${sessionId}`, 'info');
    
    // Register the session with the claim service
    claimService.registerSession(sessionId);
    
    // Subscribe to claim updates
    const unsubscribe = claimService.subscribeToClaimQueue(sessionId, (updatedClaims) => {
      setClaims(updatedClaims);
      
      // Show toast for new claims
      if (updatedClaims.length > 0 && claims.length < updatedClaims.length) {
        const newCount = updatedClaims.length - claims.length;
        toast({
          title: `${newCount} New Claim${newCount > 1 ? 's' : ''}`,
          description: "Please review pending bingo claims",
          variant: "default",
        });
      }
    });
    
    // Also listen for broadcast claim events as a backup
    const channel = supabase.channel('game-updates')
      .on('broadcast', { event: 'new-claim' }, payload => {
        if (payload.payload && payload.payload.sessionId === sessionId) {
          logWithTimestamp(`Received new claim broadcast for session ${sessionId}`, 'info');
          // Force refetch claims - this is just a backup, the subscription should handle it
          claimService.subscribeToClaimQueue(sessionId, () => {});
        }
      })
      .subscribe();
      
    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [sessionId, claims.length, toast]);

  // Validate a claim (approve or reject)
  const validateClaim = useCallback(async (claim: BingoClaim, isValid: boolean) => {
    if (!sessionId || !claim || !claim.id) {
      logWithTimestamp('Cannot validate claim - missing required information', 'error');
      return false;
    }
    
    if (isProcessingClaim) {
      logWithTimestamp('Claim validation already in progress', 'warn');
      return false;
    }
    
    setIsProcessingClaim(true);
    
    try {
      logWithTimestamp(`Processing claim ${claim.id} as ${isValid ? 'valid' : 'invalid'}`, 'info');
      
      const success = await claimService.processClaim(claim.id, sessionId, isValid);
      
      if (success) {
        toast({
          title: isValid ? "Claim Validated" : "Claim Rejected",
          description: `The claim by player ${claim.playerName} has been ${isValid ? 'validated' : 'rejected'}.`,
          duration: 3000,
        });
      } else {
        toast({
          title: "Processing Failed",
          description: "Failed to process the claim. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during claim validation.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, isProcessingClaim, toast]);

  // Get the count of pending claims
  const claimsCount = claims.length;

  return {
    claims,
    claimsCount,
    validateClaim,
    isProcessingClaim
  };
}
