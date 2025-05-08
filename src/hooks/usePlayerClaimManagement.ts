
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
              duration: 3000, // Reduced to 3 seconds 
            });
          } else {
            setClaimStatus('invalid');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not verified.",
              variant: "destructive",
              duration: 3000, // Reduced to 3 seconds
            });
          }
          
          // Reset status after a delay
          setTimeout(() => {
            setClaimStatus('none');
          }, 3000); // Match toast duration
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, toast]);

  // Handle submitting a bingo claim - organized by ticket status
  const submitClaim = useCallback(async (tickets: any[]) => {
    if (!playerCode || !playerId || !sessionId || !playerName) {
      logWithTimestamp('Cannot submit claim - missing required information', 'error');
      return false;
    }
    
    if (isSubmittingClaim) {
      logWithTimestamp('Claim submission already in progress', 'warn');
      return false;
    }
    
    if (!tickets || tickets.length === 0) {
      logWithTimestamp('No tickets provided for claim', 'error');
      return false;
    }
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // First, process tickets to determine which need to be submitted as claims
      // Calculate "to-go" count for each ticket
      const ticketsWithCounts = tickets.map(ticket => {
        const toGoCount = ticket.numbers.filter(n => !ticket.calledNumbers.includes(n)).length;
        return {
          ...ticket,
          toGoCount
        };
      });
      
      // Find tickets with 0 "to-go" (winning tickets)
      const winningTickets = ticketsWithCounts.filter(t => t.toGoCount === 0);
      
      // Determine if we should submit individual claims for winning tickets
      let success = false;
      
      if (winningTickets.length > 0) {
        logWithTimestamp(`Found ${winningTickets.length} winning tickets with 0 to-go. Submitting individual claims.`);
        
        // Submit each winning ticket as a separate claim
        for (const ticket of winningTickets) {
          const claimData = {
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
            calledNumbers: ticket.calledNumbers || [],
            lastCalledNumber: ticket.lastCalledNumber || null,
            gameType,
            toGoCount: 0
          };
          
          const result = claimService.submitClaim(claimData);
          if (result) success = true;
        }
      } else {
        logWithTimestamp('No winning tickets found. Submitting all tickets as a single claim.');
        
        // No winning tickets - sort by fewest numbers to go and submit the best one
        const bestTicket = [...ticketsWithCounts].sort((a, b) => a.toGoCount - b.toGoCount)[0];
        
        const claimData = {
          playerId,
          playerName,
          sessionId,
          gameNumber,
          winPattern: currentWinPattern || 'oneLine',
          ticket: {
            serial: bestTicket.serial,
            perm: bestTicket.perm,
            position: bestTicket.position,
            layoutMask: bestTicket.layoutMask || bestTicket.layout_mask,
            numbers: bestTicket.numbers
          },
          calledNumbers: bestTicket.calledNumbers || [],
          lastCalledNumber: bestTicket.lastCalledNumber || null,
          gameType,
          toGoCount: bestTicket.toGoCount
        };
        
        success = claimService.submitClaim(claimData);
      }
      
      if (success) {
        toast({
          title: "Bingo Claim Submitted",
          description: "Your claim has been submitted and is waiting for verification.",
          duration: 3000, // Reduced to 3 seconds
        });
      } else {
        toast({
          title: "Claim Submission Failed",
          description: "Failed to submit your claim. Please try again.",
          variant: "destructive",
          duration: 3000, // Reduced to 3 seconds
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
        duration: 3000, // Reduced to 3 seconds
      });
      setClaimStatus('none');
      return false;
    } finally {
      setIsSubmittingClaim(false);
      
      // Auto-reset back to 'none' after 10 seconds if still pending (reduced from 15)
      setTimeout(() => {
        setClaimStatus(prev => prev === 'pending' ? 'none' : prev);
      }, 10000);
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
