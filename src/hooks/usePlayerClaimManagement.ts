
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

  // Create a custom toast with ticket display
  const showTicketToast = useCallback((title: string, description: string, ticketData: any, calledNumbers: number[] = []) => {
    if (!ticketData) {
      toast({
        title,
        description,
        duration: 5000,
      });
      return;
    }

    // Create a simplified ticket display for the toast
    const TicketToast = () => {
      // Get first 5 numbers to show in simplified view
      const displayNumbers = ticketData.numbers?.slice(0, 5) || [];
      const totalMarked = ticketData.numbers?.filter((n: number) => calledNumbers.includes(n)).length || 0;
      
      return (
        <div className="flex flex-col">
          <div className="text-sm">{description}</div>
          <div className="flex items-center gap-1 mt-1">
            {displayNumbers.map((num: number, i: number) => (
              <div 
                key={`toast-num-${i}`}
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs 
                  ${calledNumbers.includes(num) ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-700"}`
                }
              >
                {num}
              </div>
            ))}
            {ticketData.numbers?.length > 5 && (
              <div className="text-xs ml-1">+{ticketData.numbers.length - 5} more</div>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Ticket: {ticketData.serial} • {totalMarked}/{ticketData.numbers?.length || 0} called
          </div>
        </div>
      );
    };

    // Use the standard toast with our custom component
    toast({
      title,
      description: <TicketToast />,
      duration: 5000,
    });
  }, [toast]);

  // Set up or clean up the claim checking channel based on session availability
  const setupClaimCheckingChannel = useCallback(() => {
    // Only set up if we have a session ID
    if (!sessionId) {
      if (claimCheckingChannelRef.current) {
        logWithTimestamp(`PlayerClaimManagement: Removing claim checking channel - no session`, 'info');
        supabase.removeChannel(claimCheckingChannelRef.current);
        claimCheckingChannelRef.current = null;
      }
      return;
    }
    
    // If we already have a channel, don't create another
    if (claimCheckingChannelRef.current) return;
    
    logWithTimestamp(`PlayerClaimManagement: Setting up claim checking listener for session ${sessionId}`, 'info');
    
    // Set up channel to listen for claim checking broadcasts
    const channel = supabase
      .channel('claim_checking_broadcaster')
      .on('broadcast', { event: 'claim-checking' }, payload => {
        logWithTimestamp(`PlayerClaimManagement: Received claim checking broadcast: ${JSON.stringify(payload.payload)}`, 'info');
        
        // Check if this is for our session
        if (payload.payload?.sessionId === sessionId) {
          const claimPlayerName = payload.payload?.playerName || 'Unknown player';
          const claimPattern = payload.payload?.winPattern || 'bingo';
          const ticket = payload.payload?.ticket;
          const calledNumbers = payload.payload?.calledNumbers || [];
          
          // Show toast notification with ticket representation
          showTicketToast(
            "Claim Being Verified",
            `The caller is verifying ${claimPlayerName}'s ${claimPattern} claim`,
            ticket,
            calledNumbers
          );
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`PlayerClaimManagement: Claim checking channel status: ${status}`, 'info');
      });
    
    // Store channel reference for cleanup
    claimCheckingChannelRef.current = channel;
  }, [sessionId, showTicketToast]);
  
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
    
    logWithTimestamp(`PlayerClaimManagement: Setting up claim result listener for session ${sessionId}`, 'info');
    
    // FIXED: Use 'game-updates' channel to match the server broadcast
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
            
            // Show toast with ticket information
            showTicketToast(
              "Bingo Verified!",
              "Your bingo claim has been verified!",
              ticket,
              calledNumbers
            );
          } else if (result === 'invalid' || result === 'rejected') {
            logWithTimestamp(`PlayerClaimManagement: Claim was rejected`, 'info');
            setClaimStatus('invalid');
            setHasActiveClaims(false);
            
            // Show toast with ticket information
            showTicketToast(
              "Claim Rejected",
              "Your bingo claim was not verified.",
              ticket,
              calledNumbers
            );
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
  }, [playerId, playerCode, sessionId, toast, setupClaimCheckingChannel, showTicketToast]);

  return {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  };
}
