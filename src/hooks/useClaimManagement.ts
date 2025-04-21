
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useClaimManagement(sessionId: string | undefined) {
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<{
    playerName: string;
    playerId: string;
    tickets: any[];
    claimId?: string;
  } | null>(null);
  const [claimQueue, setClaimQueue] = useState<Array<{
    playerName: string;
    playerId: string;
    claimId?: string;
  }>>([]);
  const [processingClaim, setProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Handle closing the claim sheet
  const handleCloseSheet = useCallback(() => {
    setShowClaimSheet(false);
    setCurrentClaim(null);
  }, []);

  // Process the next claim in queue
  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim || showClaimSheet) {
      return;
    }

    setProcessingClaim(true);
    const nextClaim = claimQueue[0];
    
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', nextClaim.playerId)
        .eq('session_id', sessionId);

      if (ticketError) {
        console.error("Error fetching ticket data:", ticketError);
        return;
      }

      console.log(`Processing claim for ${nextClaim.playerName} with ${ticketData?.length || 0} tickets`);
      
      setCurrentClaim({
        playerName: nextClaim.playerName,
        playerId: nextClaim.playerId,
        tickets: ticketData || [],
        claimId: nextClaim.claimId
      });
      
      setClaimQueue(prev => prev.slice(1));
      
      console.log("Opening sheet for claim verification!");
      setShowClaimSheet(true);
    } catch (error) {
      console.error("Error processing next claim:", error);
      setClaimQueue(prev => prev.slice(1));
    } finally {
      setProcessingClaim(false);
    }
  }, [claimQueue, processingClaim, sessionId, showClaimSheet]);

  // Auto-process next claim when ready
  useEffect(() => {
    if (!showClaimSheet && !currentClaim && claimQueue.length > 0) {
      const timer = setTimeout(() => {
        processNextClaim();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showClaimSheet, currentClaim, claimQueue, processNextClaim]);

  // Listen for real-time bingo claims
  useEffect(() => {
    if (!sessionId) return;
    
    console.log("Setting up real-time listener for bingo claims on session", sessionId);
    
    const channel = supabase
      .channel('caller-claims')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          
          if (payload.payload && payload.payload.playerId && payload.payload.playerName) {
            const claimData = payload.payload;
            
            // Check if this claim is already being processed or in queue
            const isDuplicate = 
              (currentClaim?.playerId === claimData.playerId) || 
              claimQueue.some(q => q.playerId === claimData.playerId);
            
            if (!isDuplicate) {
              console.log("Adding new claim to queue:", claimData.playerName);
              setClaimQueue(prev => [
                ...prev,
                {
                  playerName: claimData.playerName,
                  playerId: claimData.playerId,
                  claimId: claimData.claimId
                }
              ]);
              
              // Only open claim sheet automatically if there's no current claim being processed
              if (!showClaimSheet && !currentClaim) {
                processNextClaim();
              }
            } else {
              console.log("Duplicate claim received, ignoring:", claimData.playerName);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Removing channel for bingo claims");
      supabase.removeChannel(channel);
    };
  }, [sessionId, currentClaim, claimQueue, showClaimSheet, processNextClaim]);

  // Manually open the claim sheet
  const openClaimSheet = useCallback(() => {
    console.log("Opening claim sheet manually");
    
    // If there are claims in the queue but no current claim is being displayed,
    // process the next claim in queue
    if (claimQueue.length > 0 && !currentClaim && !showClaimSheet) {
      processNextClaim();
    } else if (currentClaim && !showClaimSheet) {
      // If there's a current claim but the sheet is closed, reopen it
      setShowClaimSheet(true);
    }
  }, [claimQueue, currentClaim, processNextClaim, showClaimSheet]);

  // Validate a claim
  const validateClaim = useCallback(async () => {
    if (!currentClaim || !sessionId) return;
    
    console.log("Validating claim for player:", currentClaim.playerName);
    
    try {
      // Update the claim status in the database if there's a claim ID
      if (currentClaim.claimId) {
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'validated' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      // Broadcast the result to all players
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'valid'
          }
        });
      
      // Close the sheet and reset current claim
      handleCloseSheet();
      
      toast({
        title: "Claim Validated",
        description: `${currentClaim.playerName}'s claim has been validated.`
      });
      
      // Process next claim if any
      setTimeout(() => {
        if (claimQueue.length > 0) {
          processNextClaim();
        }
      }, 500);
      
    } catch (error) {
      console.error("Error validating claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to validate the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast, handleCloseSheet, claimQueue, processNextClaim]);

  // Reject a claim
  const rejectClaim = useCallback(async () => {
    if (!currentClaim || !sessionId) return;
    
    console.log("Rejecting claim for player:", currentClaim.playerName);
    
    try {
      // Update the claim status in the database if there's a claim ID
      if (currentClaim.claimId) {
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'rejected' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      // Broadcast the result to all players
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'rejected'
          }
        });
      
      // Close the sheet and reset current claim
      handleCloseSheet();
      
      toast({
        title: "Claim Rejected",
        description: `${currentClaim.playerName}'s claim has been rejected.`
      });
      
      // Process next claim if any
      setTimeout(() => {
        if (claimQueue.length > 0) {
          processNextClaim();
        }
      }, 500);
      
    } catch (error) {
      console.error("Error rejecting claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to reject the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast, handleCloseSheet, claimQueue, processNextClaim]);

  return {
    showClaimSheet,
    setShowClaimSheet: handleCloseSheet,
    currentClaim,
    setCurrentClaim,
    claimQueue,
    openClaimSheet,
    validateClaim,
    rejectClaim
  };
}
