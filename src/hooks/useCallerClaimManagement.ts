
import { useState, useEffect, useCallback } from 'react';
import { claimService, BingoClaim } from '@/services/ClaimManagementService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Register session with claim service on mount
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up claim listener for session ${sessionId}`, 'info');
    
    // Register the session with the claim service
    claimService.registerSession(sessionId);
    
    // Subscribe to claim updates
    const unsubscribe = claimService.subscribeToClaimQueue(sessionId, (updatedClaims) => {
      logWithTimestamp(`Received claim update: ${updatedClaims.length} claims`, 'info');
      if (updatedClaims.length > 0) {
        logWithTimestamp(`First claim details: ${JSON.stringify(updatedClaims[0])}`, 'debug');
      }
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
        logWithTimestamp(`Received new claim broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        if (payload.payload && payload.payload.sessionId === sessionId) {
          // Force refetch claims 
          fetchClaims();
          
          // Show toast to alert the caller
          toast({
            title: "New Bingo Claim!",
            description: `A player has claimed bingo! Check the claims panel.`,
            variant: "destructive",
          });
        }
      })
      .subscribe();
      
    // Also listen for the bingo-claim event (alternate format)
    const bingoClaimChannel = supabase.channel('bingo-claim-channel')
      .on('broadcast', { event: 'bingo-claim' }, payload => {
        logWithTimestamp(`Received bingo-claim broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        if (payload.payload && payload.payload.sessionId === sessionId) {
          // Force refetch claims
          fetchClaims();
          
          // If we don't already have this claim, use submitClaim method instead of addClaim
          if (!claims.some(claim => claim.id === payload.payload.id)) {
            // Create claim data in expected format
            const claimData = {
              playerId: payload.payload.playerId,
              playerName: payload.payload.playerName || "Unknown Player",
              sessionId: sessionId,
              gameNumber: payload.payload.gameNumber || 1,
              winPattern: payload.payload.winPattern || "Unknown Pattern",
              gameType: payload.payload.gameType || "mainstage",
              ticket: payload.payload.ticket || {
                serial: "unknown",
                perm: 0,
                position: 0,
                layoutMask: 0,
                numbers: []
              },
              calledNumbers: payload.payload.calledNumbers || [],
              lastCalledNumber: payload.payload.lastCalledNumber || null
            };
            
            // Use submitClaim instead of addClaim
            claimService.submitClaim(claimData);
            
            // Refetch to get the new claim
            fetchClaims();
          }
        }
      })
      .subscribe();
      
    return () => {
      logWithTimestamp(`Cleaning up claim listener for session ${sessionId}`, 'info');
      unsubscribe();
      supabase.removeChannel(channel);
      supabase.removeChannel(bingoClaimChannel);
    };
  }, [sessionId, toast, claims.length]);

  // Fetch claims manually (can be called to refresh)
  const fetchClaims = useCallback(() => {
    if (!sessionId) {
      logWithTimestamp('Cannot fetch claims - missing sessionId', 'warn');
      return;
    }
    
    logWithTimestamp(`Manually fetching claims for session ${sessionId}`, 'info');
    const sessionClaims = claimService.getClaimsForSession(sessionId);
    
    // Debug log the claims we found
    logWithTimestamp(`Found ${sessionClaims.length} claims in service`, 'info');
    if (sessionClaims.length > 0) {
      logWithTimestamp(`Claims: ${JSON.stringify(sessionClaims)}`, 'debug');
    }
    
    setClaims(sessionClaims);
    
    return sessionClaims;
  }, [sessionId]);

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
        
        // Re-fetch claims to update the UI
        fetchClaims();
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
  }, [sessionId, isProcessingClaim, toast, fetchClaims]);

  // Get the count of pending claims
  const claimsCount = claims.length;

  return {
    claims,
    claimsCount,
    validateClaim,
    isProcessingClaim,
    fetchClaims
  };
}
