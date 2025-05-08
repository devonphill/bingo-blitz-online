
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { claimService, BingoClaim } from '@/services/ClaimManagementService';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const [claimsCount, setClaimsCount] = useState(0);
  const { toast } = useToast();

  // Listen to claim queue changes
  useEffect(() => {
    if (!sessionId) return;
    
    // Register to track this session
    claimService.registerSession(sessionId);
    
    // Subscribe to claim queue updates
    const unsubscribe = claimService.subscribeToClaimQueue(sessionId, (sessionClaims) => {
      setClaims(sessionClaims);
      setClaimsCount(sessionClaims.length);
      
      // Show toast notification when new claims arrive
      if (sessionClaims.length > 0 && sessionClaims.length > claims.length) {
        toast({
          title: "New Bingo Claim",
          description: `${sessionClaims[0].playerName} is claiming bingo!`,
          duration: 5000
        });
      }
    });
    
    return () => {
      unsubscribe();
      // Unregister session when component unmounts
      claimService.unregisterSession(sessionId);
    };
  }, [sessionId, toast, claims.length]);

  // Handle validating a claim
  const validateClaim = useCallback(async (claim: BingoClaim, isValid: boolean) => {
    if (!sessionId) return false;
    
    setIsProcessingClaim(true);
    try {
      logWithTimestamp(`Processing claim ${claim.id} as ${isValid ? 'valid' : 'invalid'}`, 'info');
      
      const success = await claimService.processClaim(claim.id, sessionId, isValid);
      
      if (success) {
        toast({
          title: isValid ? "Claim Validated" : "Claim Rejected",
          description: `${claim.playerName}'s claim has been ${isValid ? 'validated' : 'rejected'}.`,
          duration: 3000
        });
      } else {
        toast({
          title: "Error Processing Claim",
          description: "Failed to process the claim. Please try again.",
          variant: "destructive",
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while processing the claim.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, toast]);

  // Clear all claims for the session
  const clearClaims = useCallback(() => {
    if (!sessionId) return;
    claimService.clearClaimsForSession(sessionId);
  }, [sessionId]);

  return {
    claims,
    claimsCount,
    validateClaim,
    clearClaims,
    isProcessingClaim
  };
}
