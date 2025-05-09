import { useState, useEffect, useCallback } from 'react';
import { claimService } from '@/services/ClaimManagementService';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { validateChannelType, ensureString } from '@/utils/typeUtils';

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

  // Force refresh function to manually reload claims when needed
  const forceRefresh = useCallback(() => {
    logWithTimestamp(`Force refreshing claims for session ${sessionId}`, 'info');
    fetchClaims();
    
    // Attempt to re-subscribe to ensure we're getting events
    setupChannelSubscription();
    
    return true;
  }, [sessionId, fetchClaims]);
  
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
      
      // Use claimService to process the claim
      const success = await claimService.processClaim(
        ensureString(claim.id),
        ensureString(sessionId),
        isValid,
        onGameProgress
      );
      
      if (!success) {
        toast({
          title: "Error",
          description: "Failed to process claim",
          variant: "destructive"
        });
        return false;
      }
      
      // Refresh claims after processing
      fetchClaims();
      
      return true;
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during claim validation",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, toast, fetchClaims]);
  
  // Function to set up channel subscription - extracted to be reusable
  const setupChannelSubscription = useCallback(() => {
    if (!sessionId) return null;
    
    logWithTimestamp(`Setting up claim listening for session ${sessionId}`, 'info');
    
    // Set up channel to listen for new claims - FIXED: using "game-updates" channel with "claim-submitted" event
    const channel = supabase
      .channel('game-updates')
      .on('broadcast', { event: 'claim-submitted' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received new claim broadcast for session ${sessionId}`, 'info');
          logWithTimestamp(`Claim details: ${JSON.stringify(payload.payload)}`, 'debug');
          
          // Refresh claims to include the new one
          fetchClaims();
          
          // Show toast notification
          toast({
            title: "New Claim Submitted!",
            description: `Player ${payload.payload.playerName || 'Unknown'} has submitted a bingo claim.`,
            duration: 8000, // Longer duration to ensure visibility
          });
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`Claim channel subscription status: ${status}`, 'info');
      });
      
    return channel;
  }, [sessionId, fetchClaims, toast]);
  
  // Listen for new claims - using the extracted function
  useEffect(() => {
    const channel = setupChannelSubscription();
      
    // Clean up on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [sessionId, setupChannelSubscription]);
  
  // Get claims count for convenience
  const claimsCount = claims.length;
  
  return {
    claims,
    claimsCount,
    fetchClaims,
    forceRefresh,
    validateClaim,
    isProcessingClaim,
    isRefreshing,
    lastRefreshTime
  };
}
