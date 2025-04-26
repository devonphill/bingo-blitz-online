
import { useState, useCallback, useEffect, useRef } from 'react';
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
  const hasCheckedInitialClaims = useRef(false);
  const { toast } = useToast();

  // Handle closing the claim sheet
  const handleCloseSheet = useCallback(() => {
    setShowClaimSheet(false);
    // We don't immediately clear currentClaim here to prevent UI jumps
    // It will be cleared before processing the next claim
  }, []);

  // Process the next claim in queue
  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim || showClaimSheet) {
      return;
    }

    // First clear any previous claim
    setCurrentClaim(null);
    
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
        // Remove the problematic claim from queue and continue
        setClaimQueue(prev => prev.slice(1));
        setProcessingClaim(false);
        return;
      }

      console.log(`Processing claim for ${nextClaim.playerName} with ${ticketData?.length || 0} tickets`);
      
      // Set the current claim after we successfully fetched the tickets
      setCurrentClaim({
        playerName: nextClaim.playerName,
        playerId: nextClaim.playerId,
        tickets: ticketData || [],
        claimId: nextClaim.claimId
      });
      
      // Remove this claim from the queue
      setClaimQueue(prev => prev.slice(1));
      
      console.log("Opening sheet for claim verification!");
      // Open the sheet automatically
      setTimeout(() => {
        setShowClaimSheet(true);
        setProcessingClaim(false);
      }, 100);
      
    } catch (error) {
      console.error("Error processing next claim:", error);
      setClaimQueue(prev => prev.slice(1));
      setProcessingClaim(false);
    }
  }, [claimQueue, processingClaim, sessionId, showClaimSheet]);

  // Check for pending claims in the database
  const checkForClaims = useCallback(async () => {
    if (!sessionId || hasCheckedInitialClaims.current) return;
    
    console.log("Performing initial check for claims, setting flag to true");
    hasCheckedInitialClaims.current = true;
    
    try {
      const { data, error } = await supabase
        .from('bingo_claims')
        .select('id, player_id, claimed_at, players(nickname)')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('claimed_at', { ascending: true });
        
      if (error) {
        console.error("Error fetching pending claims:", error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log("Found pending claims:", data);
        
        // Add pending claims to the queue if they're not already there
        data.forEach(claim => {
          const isDuplicate = 
            (currentClaim?.playerId === claim.player_id) || 
            claimQueue.some(q => q.playerId === claim.player_id);
            
          if (!isDuplicate) {
            setClaimQueue(prev => [
              ...prev, 
              {
                playerName: claim.players?.nickname || 'Unknown',
                playerId: claim.player_id,
                claimId: claim.id
              }
            ]);
          }
        });
      }
    } catch (error) {
      console.error("Error checking for pending claims:", error);
    }
  }, [sessionId, currentClaim, claimQueue]);

  // Auto-process next claim when ready
  useEffect(() => {
    if (!showClaimSheet && !processingClaim && claimQueue.length > 0) {
      const timer = setTimeout(() => {
        processNextClaim();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showClaimSheet, processingClaim, claimQueue, processNextClaim]);

  // Listen for real-time bingo claims - with important fixes
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
              
              toast({
                title: "New Claim!",
                description: `${claimData.playerName} has claimed bingo!`,
                variant: "default",
              });
              
              // Automatically process the next claim if not currently showing or processing one
              if (!showClaimSheet && !processingClaim && !currentClaim) {
                // Add slight delay to ensure the queue is updated first
                setTimeout(() => {
                  processNextClaim();
                }, 300);
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
  }, [sessionId, currentClaim, claimQueue, showClaimSheet, processingClaim, processNextClaim, toast]);

  // Manually open the claim sheet
  const openClaimSheet = useCallback(() => {
    console.log("Opening claim sheet manually");
    
    // If there are claims in the queue but no current claim is being displayed,
    // process the next claim in queue
    if (claimQueue.length > 0 && !currentClaim && !showClaimSheet && !processingClaim) {
      processNextClaim();
    } else if (currentClaim && !showClaimSheet && !processingClaim) {
      // If there's a current claim but the sheet is closed, reopen it
      setShowClaimSheet(true);
    }
  }, [claimQueue, currentClaim, processNextClaim, showClaimSheet, processingClaim]);

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
      
      toast({
        title: "Claim Validated",
        description: `${currentClaim.playerName}'s claim has been validated.`
      });
      
      // The sheet will be closed by the confirmation callback with a delay
      
    } catch (error) {
      console.error("Error validating claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to validate the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast]);

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
      
      toast({
        title: "Claim Rejected",
        description: `${currentClaim.playerName}'s claim has been rejected.`
      });
      
      // The sheet will be closed by the confirmation callback with a delay
      
    } catch (error) {
      console.error("Error rejecting claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to reject the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast]);

  return {
    showClaimSheet,
    setShowClaimSheet: handleCloseSheet,
    currentClaim,
    setCurrentClaim,
    claimQueue,
    openClaimSheet,
    validateClaim,
    rejectClaim,
    processNextClaim,
    checkForClaims
  };
}
