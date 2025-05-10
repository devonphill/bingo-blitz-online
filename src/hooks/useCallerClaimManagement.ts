
import { useState, useEffect, useCallback, useRef } from 'react';
import { claimService } from '@/services/ClaimManagementService';
import { claimStorageService } from '@/services/ClaimStorageService';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { ClaimData } from '@/types/claim';
import { generateUUID } from '@/services/ClaimUtils';

/**
 * Hook for managing bingo claims from the caller's perspective
 */
export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isProcessingClaim, setIsProcessingClaim] = useState<boolean>(false);
  const { toast } = useToast();
  const network = useNetwork(); // Get network context
  const channelRef = useRef<any>(null);
  const claimCheckingChannelRef = useRef<any>(null);
  
  // Refresh claims from the service
  const fetchClaims = useCallback(() => {
    if (!sessionId) {
      setClaims([]);
      return;
    }
    
    logWithTimestamp(`Manually fetching claims for session ${sessionId}`);
    setIsRefreshing(true);
    
    try {
      // Use claimStorageService directly to ensure we're getting the actual stored claims
      const sessionClaims = claimStorageService.getClaimsForSession(sessionId);
      logWithTimestamp(`Found ${sessionClaims.length} claims directly from storage service for session ${sessionId}`, 'info');
      
      // For debugging
      if (sessionClaims.length > 0) {
        sessionClaims.forEach((claim, idx) => {
          logWithTimestamp(`Claim ${idx+1}: ID=${claim.id}, Player=${claim.playerName || claim.playerId}`, 'debug');
        });
      }
      
      setClaims(sessionClaims);
      setLastRefreshTime(Date.now());
      
      // Setup or cleanup claim checking channel based on having claims
      manageClaimCheckingChannel(sessionClaims.length > 0);
      
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
  
  // Manage the claim checking channel based on having claims
  const manageClaimCheckingChannel = useCallback((hasActiveClaims: boolean) => {
    // Only manage if we have a session ID
    if (!sessionId) return;
    
    // If we have claims and no channel, set up the claim checking channel
    if (hasActiveClaims && !claimCheckingChannelRef.current) {
      logWithTimestamp(`Setting up claim checking channel for session ${sessionId}`, 'info');
      
      const channel = supabase.channel('claim_checking_broadcaster')
        .subscribe((status) => {
          logWithTimestamp(`Claim checking channel subscription status: ${status}`, 'info');
        });
        
      claimCheckingChannelRef.current = channel;
    } 
    // If we have no claims and a channel, clean it up
    else if (!hasActiveClaims && claimCheckingChannelRef.current) {
      logWithTimestamp(`Cleaning up claim checking channel - no active claims`, 'info');
      
      supabase.removeChannel(claimCheckingChannelRef.current);
      claimCheckingChannelRef.current = null;
    }
  }, [sessionId]);
  
  // Create a claim directly from broadcast payload
  const createClaimFromBroadcast = useCallback((payload: any): ClaimData | null => {
    try {
      if (!payload || !payload.sessionId) {
        logWithTimestamp(`Invalid claim broadcast payload`, 'error');
        return null;
      }
      
      // Construct a valid claim object from the broadcast payload
      const claimData: ClaimData = {
        id: payload.claimId || payload.id || generateUUID(),
        timestamp: payload.timestamp || new Date().toISOString(),
        sessionId: payload.sessionId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        gameType: payload.gameType || 'mainstage',
        winPattern: payload.winPattern || 'oneLine',
        status: 'pending',
        ticket: payload.ticket,
        toGoCount: payload.toGoCount || 0,
        calledNumbers: payload.calledNumbers || [],
        lastCalledNumber: payload.lastCalledNumber || null,
        hasLastCalledNumber: payload.hasLastCalledNumber || false
      };
      
      logWithTimestamp(`Created claim object from broadcast: ID=${claimData.id}, Player=${claimData.playerName || claimData.playerId}`, 'info');
      return claimData;
    } catch (err) {
      logWithTimestamp(`Error creating claim from broadcast: ${(err as Error).message}`, 'error');
      return null;
    }
  }, []);
  
  // Method to validate a claim
  const validateClaim = useCallback(async (
    claim: ClaimData, 
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
  
  // Function to handle a new claim broadcast
  const handleClaimBroadcast = useCallback((payload: any) => {
    if (!payload || payload.sessionId !== sessionId) return;
    
    logWithTimestamp(`Received new claim broadcast for session ${sessionId}`, 'info');
    logWithTimestamp(`Broadcast payload: ${JSON.stringify(payload)}`, 'debug');
    
    // Convert broadcast payload to a claim object
    const claimData = createClaimFromBroadcast(payload);
    if (!claimData) {
      logWithTimestamp(`Failed to create claim from broadcast`, 'error');
      return;
    }
    
    // Directly store the claim in storage service
    const stored = claimStorageService.storeClaim(claimData);
    
    if (stored) {
      logWithTimestamp(`Successfully stored broadcast claim in local storage: ${claimData.id}`, 'info');
      
      // Show toast notification
      toast({
        title: "New Claim Submitted!",
        description: `Player ${claimData.playerName || 'Unknown'} has submitted a bingo claim.`,
        duration: 8000, // Longer duration to ensure visibility
      });
      
      // Refresh the claims list
      fetchClaims();
    } else {
      logWithTimestamp(`Failed to store broadcast claim in local storage`, 'error');
    }
  }, [sessionId, toast, fetchClaims, createClaimFromBroadcast]);
  
  // Function to set up channel subscription - extracted to be reusable
  const setupChannelSubscription = useCallback(() => {
    if (!sessionId) return null;
    
    // Clean up old channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    
    logWithTimestamp(`Setting up claim listening for session ${sessionId}`, 'info');
    
    // Set up channel to listen for new claims - using "game-updates" channel with "claim-submitted" event
    const channel = supabase
      .channel('game-updates')
      .on('broadcast', { event: 'claim-submitted' }, payload => {
        logWithTimestamp(`Received broadcast event: claim-submitted`, 'info');
        handleClaimBroadcast(payload.payload);
      })
      .subscribe((status) => {
        logWithTimestamp(`Claim channel subscription status: ${status}`, 'info');
      });
      
    // Store the channel reference for cleanup
    channelRef.current = channel;
    return channel;
  }, [sessionId, handleClaimBroadcast]);
  
  // Listen for new claims - using the extracted function
  useEffect(() => {
    const channel = setupChannelSubscription();
      
    // Initial fetch
    fetchClaims();
    
    // Clean up on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      
      // Also clean up the claim checking channel if it exists
      if (claimCheckingChannelRef.current) {
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
    };
  }, [sessionId, setupChannelSubscription, fetchClaims]);
  
  // Periodic refresh to ensure claims are up to date
  useEffect(() => {
    if (!sessionId) return;
    
    const interval = setInterval(() => {
      fetchClaims();
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, fetchClaims]);
  
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
