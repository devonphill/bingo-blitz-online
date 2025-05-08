
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { claimService } from '@/services/ClaimManagementService';
import { logWithTimestamp } from '@/utils/logUtils';

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
  const [lastClaimId, setLastClaimId] = useState<string | null>(null);
  const { toast } = useToast();

  // Listen for claim result broadcasts
  useEffect(() => {
    if (!playerId) return;
    
    logWithTimestamp(`Setting up claim result listener for player ${playerId}`, 'info');
    
    const channel = supabase
      .channel('claim-results-channel')
      .on('broadcast', { event: 'claim-result' }, payload => {
        if (payload.payload && payload.payload.playerId === playerId) {
          logWithTimestamp(`Received claim result for player ${playerId}: ${payload.payload.result}`, 'info');
          
          if (payload.payload.result === 'valid') {
            setClaimStatus('valid');
            toast({
              title: "Bingo Validated!",
              description: "Your bingo claim has been verified. Congratulations!",
              variant: "default",
            });
          } else {
            setClaimStatus('invalid');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not verified.",
              variant: "destructive",
            });
          }
          
          // Reset status after a delay
          setTimeout(() => {
            setClaimStatus('none');
          }, 10000);
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, toast]);

  // Handle submitting a bingo claim
  const submitClaim = useCallback(async (ticket: any, calledNumbers: number[], lastCalledNumber: number | null) => {
    if (!playerCode || !playerId || !sessionId || !playerName) {
      logWithTimestamp('Cannot submit claim - missing required information', 'error');
      return false;
    }
    
    if (isSubmittingClaim) {
      logWithTimestamp('Claim submission already in progress', 'warn');
      return false;
    }
    
    if (!ticket) {
      logWithTimestamp('No ticket provided for claim', 'error');
      return false;
    }
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      const claim = {
        playerId,
        playerName,
        sessionId,
        gameNumber, 
        winPattern: currentWinPattern || 'oneLine',
        ticket: {
          serial: ticket.serial,
          perm: ticket.perm,
          position: ticket.position,
          layoutMask: ticket.layoutMask || ticket.layout_mask,
          numbers: ticket.numbers
        },
        calledNumbers,
        lastCalledNumber,
        gameType
      };
      
      logWithTimestamp('Submitting bingo claim', 'info', { claim });
      const success = claimService.submitClaim(claim);
      
      if (success) {
        toast({
          title: "Bingo Claim Submitted",
          description: "Your claim has been submitted and is waiting for verification.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Claim Submission Failed",
          description: "Failed to submit your claim. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
        setClaimStatus('none');
      }
      
      return success;
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while submitting your claim.",
        variant: "destructive",
      });
      setClaimStatus('none');
      return false;
    } finally {
      setIsSubmittingClaim(false);
      
      // Auto-reset back to 'none' after 30 seconds if still pending
      setTimeout(() => {
        setClaimStatus(prev => prev === 'pending' ? 'none' : prev);
      }, 30000);
    }
  }, [playerCode, playerId, sessionId, playerName, gameNumber, currentWinPattern, gameType, isSubmittingClaim, toast]);

  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus
  };
}
