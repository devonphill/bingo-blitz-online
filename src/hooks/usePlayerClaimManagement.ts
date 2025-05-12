
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import { processTicketLayout } from '@/utils/ticketUtils';
import { toast as sonnerToast } from 'sonner';

/**
 * Hook for managing bingo claims from the player perspective
 */
export function usePlayerClaimManagement(
  playerCode: string | null,
  playerId: string | null,
  sessionId: string | null,
  playerName: string | null,
  gameType: string = 'mainstage',
  currentWinPattern: string | null = null,
  gameNumber: number = 1
) {
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [hasActiveClaims, setHasActiveClaims] = useState(false);
  const { toast } = useToast();
  const claimChannelRef = useRef<any>(null);
  const claimCheckingChannelRef = useRef<any>(null);
  
  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    logWithTimestamp(`PlayerClaimManagement: Resetting claim status from ${claimStatus} to none`, 'info');
    setClaimStatus('none');
  }, [claimStatus]);

  // Set up or clean up the claim checking channel based on session availability
  const setupClaimCheckingChannel = useCallback(() => {
    // Only set up if we have a session ID and no existing channel
    if (!sessionId) {
      if (claimCheckingChannelRef.current) {
        logWithTimestamp(`PlayerClaimManagement: Removing claim checking channel - no session`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
      return;
    }
    
    // If we already have a channel, don't create another
    if (claimCheckingChannelRef.current) {
      logWithTimestamp(`PlayerClaimManagement: Claim checking channel already exists for session ${sessionId}`, 'info');
      return;
    }
    
    logWithTimestamp(`PlayerClaimManagement: Setting up claim checking listener for session ${sessionId}`, 'info');
    
    // Set up channel to listen for claim checking broadcasts
    const channel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`PlayerClaimManagement: Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        // We don't need any additional processing here as the BingoClaim component
        // now handles displaying the claim checking dialog
      })
      .subscribe((status) => {
        logWithTimestamp(`PlayerClaimManagement: Claim checking channel status: ${status}`, 'info');
      });
    
    // Store channel reference for cleanup
    claimCheckingChannelRef.current = channel;
  }, [sessionId]);
  
  // Submit a claim
  const submitClaim = useCallback(async (ticket: any) => {
    if (!playerCode || !sessionId) {
      toast({
        title: "Cannot Claim",
        description: "Missing player information or session ID",
        variant: "destructive"
      });
      return false;
    }
    
    logWithTimestamp(`PlayerClaimManagement: Submitting claim for ${playerCode} in ${sessionId}`, 'info');
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // Use correct channel name "game-updates" and event name "claim-submitted"
      const channel = supabase.channel('game-updates');
      
      // Create payload to send
      const payload = {
        type: validateChannelType('broadcast'),
        event: 'claim-submitted',
        payload: {
          playerCode,
          playerId,
          sessionId,
          playerName: playerName || playerCode,
          gameType,
          winPattern: currentWinPattern,
          gameNumber,
          timestamp: new Date().toISOString(),
          ticket: {
            serial: ticket.serial,
            perm: ticket.perm,
            position: ticket.position,
            layoutMask: ticket.layout_mask || ticket.layoutMask,
            numbers: ticket.numbers
          }
        }
      };
      
      logWithTimestamp(`PlayerClaimManagement: Submitting claim with payload: ${JSON.stringify(payload.payload)}`, 'info');
      
      // Send claim via real-time channel
      await channel.send(payload);
      
      logWithTimestamp(`PlayerClaimManagement: Claim broadcast sent successfully`, 'info');
      
      toast({
        title: "Bingo Submitted!",
        description: "Your claim has been submitted for verification.",
        duration: 3000,
      });
      
      // Update active claims state
      setHasActiveClaims(true);
      
      // Make sure the claim checking channel is set up
      setupClaimCheckingChannel();
      
      // Keep the claim status as pending until we get a result
      return true;
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: "Claim Error",
        description: "Failed to submit your bingo claim.",
        variant: "destructive"
      });
      setClaimStatus('none');
      return false;
    } finally {
      // Keep the claim status as pending but stop the submitting indicator
      setIsSubmittingClaim(false);
    }
  }, [playerCode, playerId, sessionId, playerName, gameType, currentWinPattern, gameNumber, toast, setupClaimCheckingChannel]);
  
  // Set up listener for claim results - FIXED: Use the same channel as the broadcaster
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`PlayerClaimManagement: No session ID available for claim result listener`, 'warn');
      return;
    }
    
    // Clean up existing channel if it exists
    if (claimChannelRef.current) {
      logWithTimestamp(`PlayerClaimManagement: Cleaning up existing claim result channel before creating a new one`, 'info');
      supabase.removeChannel(claimChannelRef.current);
      claimChannelRef.current = null;
    }
    
    logWithTimestamp(`PlayerClaimManagement: Setting up claim result listener for session ${sessionId}`, 'info');
    
    // FIXED: Use 'game-updates' channel consistently to match the server broadcast
    const channel = supabase.channel('game-updates')
      .on('broadcast', { event: 'claim-result' }, payload => {
        const result = payload.payload?.result;
        const targetPlayerId = payload.payload?.playerId;
        const targetSessionId = payload.payload?.sessionId;
        const ticket = payload.payload?.ticket;
        const calledNumbers = payload.payload?.calledNumbers || [];
        
        logWithTimestamp(`PlayerClaimManagement: Received claim result: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this result is for us
        if ((targetPlayerId === playerId || targetPlayerId === playerCode) && targetSessionId === sessionId) {
          // Update our claim status based on the result
          if (result === 'valid') {
            logWithTimestamp(`PlayerClaimManagement: Claim was validated!`, 'info');
            setClaimStatus('valid');
            setHasActiveClaims(false);
          } else if (result === 'invalid' || result === 'rejected') {
            logWithTimestamp(`PlayerClaimManagement: Claim was rejected`, 'info');
            setClaimStatus('invalid');
            setHasActiveClaims(false);
          }
        } else if (targetSessionId === sessionId) {
          // This is a claim result for someone else in our session
          logWithTimestamp(`PlayerClaimManagement: Received claim result for another player in our session`, 'info');
          // BingoClaim component will handle displaying it
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`PlayerClaimManagement: Result channel subscription status: ${status}`, 'info');
      });
    
    // Store the channel for cleanup  
    claimChannelRef.current = channel;
    
    // Also set up the claim checking channel
    setupClaimCheckingChannel();
    
    return () => {
      if (claimChannelRef.current) {
        logWithTimestamp(`PlayerClaimManagement: Removing claim result channel`, 'info');
        supabase.removeChannel(claimChannelRef.current);
        claimChannelRef.current = null;
      }
      
      if (claimCheckingChannelRef.current) {
        logWithTimestamp(`PlayerClaimManagement: Removing claim checking channel`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
    };
  }, [sessionId, playerId, playerCode, setupClaimCheckingChannel]);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  };
}
