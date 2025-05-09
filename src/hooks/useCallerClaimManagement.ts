
import { useState, useEffect, useCallback } from 'react';
import { claimService } from '@/services/ClaimManagementService';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { validateChannelType } from '@/utils/typeUtils';

/**
 * Hook for managing bingo claims from the caller's perspective
 */
export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isProcessingClaim, setIsProcessingClaim] = useState<boolean>(false);
  const { toast } = useToast();
  const network = useNetwork(); // Get network context
  
  // Refresh claims from the service
  const fetchClaims = useCallback(() => {
    if (!sessionId) {
      setClaims([]);
      return;
    }
    
    logWithTimestamp(`Manually fetching claims for session ${sessionId}`);
    setIsRefreshing(true);
    
    try {
      // Use claimService directly
      const sessionClaims = claimService.getClaimsForSession(sessionId);
      logWithTimestamp(`Found ${sessionClaims.length} claims from service`, 'info');
      setClaims(sessionClaims);
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);
  
  // Method to validate a claim
  const validateClaim = useCallback(async (
    claim: any, 
    isValid: boolean, 
    onGameProgress?: () => void
  ) => {
    if (!sessionId || !claim?.id) {
      toast({
        title: "Error",
        description: "Invalid claim data",
        variant: "destructive"
      });
      return false;
    }
    
    setIsProcessingClaim(true);
    try {
      logWithTimestamp(`Processing claim ${claim.id} with result: ${isValid ? 'valid' : 'invalid'}`);
      // Use network context to process claim
      const result = await network.validateClaim(claim, isValid);
      
      if (result) {
        toast({
          title: isValid ? "Claim Verified" : "Claim Rejected",
          description: `${claim.playerName || 'Player'}'s claim has been ${isValid ? 'verified' : 'rejected'}.`,
          duration: 3000,
        });
        
        // If the claim was valid and we have a progress callback, call it
        if (isValid && onGameProgress) {
          onGameProgress();
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "Failed to process claim",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
      // Refresh claims after processing
      fetchClaims();
    }
  }, [sessionId, toast, fetchClaims, network]);
  
  // Set up real-time listener for new claims
  useEffect(() => {
    if (!sessionId) {
      setClaims([]);
      return;
    }
    
    logWithTimestamp(`Setting up claim listener for session ${sessionId}`);
    
    // Listen for claim submissions
    const channel = supabase.channel('game-updates')
      .on('broadcast', { event: 'claim-submitted' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received real-time claim notification for session ${sessionId}`, 'info');
          
          // Show a toast notification for the new claim
          toast({
            title: "New Bingo Claim!",
            description: `${payload.payload.playerName || 'A player'} has claimed bingo!`,
            variant: "destructive",
            duration: 5000,
          });
          
          // Refresh claims to get the latest data
          fetchClaims();
        }
      })
      .subscribe();
      
    // Fetch claims initially
    fetchClaims();
    
    // Clean up
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchClaims, toast]);
  
  // Return claims, count, refresh function and validation methods
  return {
    claims,
    claimsCount: claims.length,
    fetchClaims,
    isRefreshing,
    lastRefreshTime,
    validateClaim,
    isProcessingClaim
  };
}
