
import { useState, useEffect, useCallback } from 'react';
import { claimService, BingoClaim } from '@/services/ClaimManagementService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
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
          duration: 5000, // 5 seconds duration
        });
      }
    });
    
    // ENHANCED: Set up multiple listeners for redundancy
    const setupChannelListeners = async () => {
      // Main channel for game updates
      const gameUpdatesChannel = supabase.channel('game-updates')
        .on('broadcast', { event: 'new-claim' }, handleClaimBroadcast)
        .subscribe();
      
      // Secondary channel specifically for caller notifications
      const callerNotificationsChannel = supabase.channel('caller-notifications')
        .on('broadcast', { event: 'new-claim' }, handleClaimBroadcast)
        .subscribe();
      
      // Session-specific channel
      const sessionChannel = supabase.channel(`session-${sessionId}`)
        .on('broadcast', { event: 'new-claim' }, handleClaimBroadcast)
        .subscribe();
      
      // Also listen for the bingo-claim event (alternate format)
      const bingoClaimChannel = supabase.channel('bingo-claim-channel')
        .on('broadcast', { event: 'bingo-claim' }, handleClaimBroadcast)
        .subscribe();

      return () => {
        supabase.removeChannel(gameUpdatesChannel);
        supabase.removeChannel(callerNotificationsChannel);
        supabase.removeChannel(sessionChannel);
        supabase.removeChannel(bingoClaimChannel);
      };
    };
    
    const cleanup = setupChannelListeners();
    
    // Set up periodic polling as a backup
    const pollInterval = setInterval(() => {
      // Only poll if it's been more than 10 seconds since our last fetch
      if (Date.now() - lastFetchTime > 10000) {
        fetchClaimsFromDatabase();
      }
    }, 15000);
    
    return () => {
      logWithTimestamp(`Cleaning up claim listener for session ${sessionId}`, 'info');
      unsubscribe();
      clearInterval(pollInterval);
      cleanup.then(removeChannels => removeChannels());
    };
  }, [sessionId, toast, claims.length, lastFetchTime]);

  // Handle claim broadcast from any channel
  const handleClaimBroadcast = useCallback((payload: any) => {
    if (!sessionId || !payload.payload) return;
    
    const claimData = payload.payload;
    
    // Check if this claim is for our session
    if (claimData.sessionId === sessionId) {
      logWithTimestamp(`Received claim broadcast: ${JSON.stringify(claimData)}`, 'info');
      
      // Force refetch claims 
      fetchClaims();
      
      // Also try to add the claim directly from the broadcast data
      tryAddClaimFromBroadcast(claimData);
      
      // Show toast to alert the caller
      toast({
        title: "New Bingo Claim!",
        description: `A player has claimed bingo! Check the claims panel.`,
        variant: "destructive",
        duration: 5000, // 5 seconds duration
      });
    }
  }, [sessionId, toast]);

  // Helper to attempt to add a claim directly from broadcast data
  const tryAddClaimFromBroadcast = useCallback((payload: any) => {
    if (!sessionId || !payload) return;
    
    try {
      logWithTimestamp(`Attempting to add claim directly from broadcast data: ${JSON.stringify(payload)}`, 'info');
      
      // Create a claim object with all necessary fields
      const claimData = {
        id: payload.claimId || payload.id || undefined,
        playerId: payload.playerId,
        playerName: payload.playerName || "Unknown Player",
        sessionId: sessionId,
        gameNumber: payload.gameNumber || 1,
        winPattern: payload.winPattern || "Unknown Pattern",
        gameType: payload.gameType || "mainstage",
        ticket: payload.ticket || {
          serial: payload.ticketSerial || "unknown",
          perm: payload.ticketPerm || 0,
          position: payload.ticketPosition || 0,
          layoutMask: payload.ticketLayoutMask || 0,
          numbers: payload.ticketNumbers || []
        },
        calledNumbers: payload.calledNumbers || [],
        lastCalledNumber: payload.lastCalledNumber || null,
        toGoCount: payload.toGoCount
      };
      
      // Submit the claim to the service
      const success = claimService.submitClaim(claimData);
      
      if (success) {
        logWithTimestamp(`Successfully added claim from broadcast for player ${payload.playerName || payload.playerId}`, 'info');
        // Refetch to update UI
        fetchClaims();
      } else {
        logWithTimestamp(`Failed to add claim from broadcast`, 'warn');
      }
    } catch (error) {
      console.error('Error processing broadcast claim:', error);
    }
  }, [sessionId]);

  // ENHANCED: Fetch claims from database as backup mechanism
  const fetchClaimsFromDatabase = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp(`Fetching pending claims from database for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null);
        
      if (error) {
        console.error('Error fetching claims from database:', error);
        return;
      }
      
      if (data && data.length > 0) {
        logWithTimestamp(`Found ${data.length} pending claims in database`, 'info');
        
        // Convert to BingoClaim format and add to service
        data.forEach(item => {
          const claim = {
            id: item.id,
            playerId: item.player_id,
            playerName: item.player_name || 'Unknown Player',
            sessionId: item.session_id,
            gameNumber: item.game_number || 1,
            winPattern: item.win_pattern || 'oneLine',
            gameType: item.game_type || 'mainstage',
            ticket: {
              serial: item.ticket_serial || 'unknown',
              perm: item.ticket_perm || 0,
              position: item.ticket_position || 0,
              layoutMask: item.ticket_layout_mask || 0,
              numbers: item.ticket_numbers || []
            },
            calledNumbers: item.called_numbers || [],
            lastCalledNumber: item.last_called_number,
            claimedAt: new Date(item.claimed_at || Date.now())
          };
          
          claimService.submitClaim(claim);
        });
        
        // Refresh claims list
        fetchClaims();
      }
    } catch (dbError) {
      console.error('Error in database claim fallback:', dbError);
    }
  }, [sessionId]);

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
    setLastFetchTime(Date.now());
    
    return sessionClaims;
  }, [sessionId]);

  // Validate a claim (approve or reject)
  const validateClaim = useCallback(async (claim: any, isValid: boolean, onGameProgress?: () => void) => {
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
      
      const success = await claimService.processClaim(claim.id, sessionId, isValid, onGameProgress);
      
      if (success) {
        toast({
          title: isValid ? "Claim Validated" : "Claim Rejected",
          description: `The claim by player ${claim.playerName} has been ${isValid ? 'validated' : 'rejected'}.`,
          duration: 3000, // Shorter duration
        });
        
        // Re-fetch claims to update the UI
        fetchClaims();
        
        return true;
      } else {
        toast({
          title: "Processing Failed",
          description: "Failed to process the claim. Please try again.",
          variant: "destructive",
          duration: 5000, // 5 seconds duration
        });
        
        return false;
      }
    } catch (error) {
      console.error('Error validating claim:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during claim validation.",
        variant: "destructive",
        duration: 5000, // 5 seconds duration
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
