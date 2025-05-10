
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { validateChannelType, ensureString } from '@/utils/typeUtils';

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
  
  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    logWithTimestamp(`PlayerClaimManagement: Resetting claim status from ${claimStatus} to none`, 'info');
    setClaimStatus('none');
  }, [claimStatus]);
  
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
  }, [playerCode, playerId, sessionId, playerName, gameType, currentWinPattern, gameNumber, toast]);
  
  // Set up listener for claim results - FIXED: Use the same channel as the broadcaster
  useEffect(() => {
    if (!sessionId) {
      logWithTimestamp(`PlayerClaimManagement: No session ID available for claim result listener`, 'warn');
      return;
    }
    
    logWithTimestamp(`PlayerClaimManagement: Setting up claim result listener for session ${sessionId}`, 'info');
    
    // FIXED: Use 'game-updates' channel to match the server broadcast
    const channel = supabase.channel('game-updates')
      .on('broadcast', { event: 'claim-result' }, payload => {
        const result = payload.payload?.result;
        const targetPlayerId = payload.payload?.playerId;
        const targetSessionId = payload.payload?.sessionId;
        
        logWithTimestamp(`PlayerClaimManagement: Received claim result: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this result is for us
        if ((targetPlayerId === playerId || targetPlayerId === playerCode) && targetSessionId === sessionId) {
          // Update our claim status based on the result
          if (result === 'valid') {
            logWithTimestamp(`PlayerClaimManagement: Claim was validated!`, 'info');
            setClaimStatus('valid');
            toast({
              title: "Bingo Verified!",
              description: "Your bingo claim has been verified!",
              duration: 5000,
            });
          } else if (result === 'invalid' || result === 'rejected') {
            logWithTimestamp(`PlayerClaimManagement: Claim was rejected`, 'info');
            setClaimStatus('invalid');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not verified.",
              variant: "destructive",
              duration: 5000,
            });
          }
        } else if (targetSessionId === sessionId) {
          // This is a claim result for someone else in our session
          logWithTimestamp(`PlayerClaimManagement: Received claim result for another player in our session`, 'info');
          // We don't need to do anything here as the BingoClaim component will handle displaying it
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`PlayerClaimManagement: Result channel subscription status: ${status}`, 'info');
      });
    
    // Store the channel for cleanup  
    claimChannelRef.current = channel;
    
    return () => {
      if (claimChannelRef.current) {
        logWithTimestamp(`PlayerClaimManagement: Removing claim result channel`, 'info');
        supabase.removeChannel(claimChannelRef.current);
        claimChannelRef.current = null;
      }
    };
  }, [playerId, playerCode, sessionId, toast]);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  };
}
