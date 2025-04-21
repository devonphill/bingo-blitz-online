
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useClaimManagement(sessionId: string | undefined) {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<{
    playerName: string;
    playerId: string;
    tickets: any[];
    claimId?: string;
  } | null>(null);
  const [claimQueue, setClaimQueue] = useState<Array<{
    playerName: string;
    playerId: string;
    claimId: string;
  }>>([]);
  const [processingClaim, setProcessingClaim] = useState(false);
  const { toast } = useToast();

  // Process the next claim in the queue
  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim) {
      return;
    }

    setProcessingClaim(true);
    const nextClaim = claimQueue[0];
    
    try {
      // Fetch player's tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', nextClaim.playerId)
        .eq('session_id', sessionId);

      if (ticketError) {
        console.error("Error fetching ticket data:", ticketError);
        toast({
          title: "Error",
          description: "Failed to fetch ticket information.",
          variant: "destructive"
        });
        return;
      }

      console.log(`Processing claim for ${nextClaim.playerName} with ${ticketData?.length || 0} tickets`);
      
      // Set the claim data and show modal
      setCurrentClaim({
        playerName: nextClaim.playerName,
        playerId: nextClaim.playerId,
        tickets: ticketData || [],
        claimId: nextClaim.claimId
      });
      
      // Remove from queue
      setClaimQueue(prev => prev.slice(1));
      
      // Open the modal
      console.log("Opening modal for claim verification!");
      setShowClaimModal(true);
    } catch (error) {
      console.error("Error processing next claim:", error);
      // Skip to next claim on error
      setClaimQueue(prev => prev.slice(1));
    } finally {
      setProcessingClaim(false);
    }
  }, [claimQueue, processingClaim, sessionId, toast]);

  // When current claim is processed, check for next claim
  useEffect(() => {
    if (!showClaimModal && !currentClaim && claimQueue.length > 0) {
      const timer = setTimeout(() => {
        processNextClaim();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showClaimModal, currentClaim, claimQueue, processNextClaim]);

  const verifyPendingClaims = useCallback(async () => {
    if (!sessionId) {
      console.log("No session ID provided to verifyPendingClaims");
      return;
    }
    
    console.log("Checking for pending claims... for session:", sessionId);

    try {
      const { data, error } = await supabase
        .from('bingo_claims')
        .select('id, player_id, claimed_at, status')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('claimed_at', { ascending: true });

      if (error) {
        console.error("Error fetching claims:", error);
        toast({
          title: "Error",
          description: "Failed to fetch pending claims.",
          variant: "destructive"
        });
        return;
      }

      console.log("Pending claims data:", data);

      if (data && data.length > 0) {
        console.log("Found pending claims:", data.length);
        
        // Process each claim - get player details for each
        for (const claim of data) {
          // Skip if we're already processing this claim ID
          if (currentClaim?.claimId === claim.id || 
              claimQueue.some(q => q.claimId === claim.id)) {
            console.log(`Claim ${claim.id} already in process or queue`);
            continue;
          }

          const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('nickname, id')
            .eq('id', claim.player_id)
            .single();

          if (playerError) {
            console.error(`Error fetching player data for claim ${claim.id}:`, playerError);
            continue;
          }

          // Add to queue
          console.log(`Adding claim for ${playerData.nickname} to queue`);
          setClaimQueue(prev => [
            ...prev, 
            { 
              playerName: playerData.nickname, 
              playerId: playerData.id,
              claimId: claim.id
            }
          ]);
        }
      } else {
        console.log("No pending claims found");
      }
    } catch (error) {
      console.error("Error in verifyPendingClaims:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while checking claims.",
        variant: "destructive"
      });
    }
  }, [sessionId, toast, currentClaim, claimQueue]);

  // After queue is updated, process the next claim if needed
  useEffect(() => {
    if (!showClaimModal && !currentClaim && claimQueue.length > 0 && !processingClaim) {
      processNextClaim();
    }
  }, [claimQueue, showClaimModal, currentClaim, processingClaim, processNextClaim]);

  const checkForClaims = useCallback(() => {
    console.log("Manual claim check button pressed! - DIRECT CALL");
    verifyPendingClaims();
  }, [verifyPendingClaims]);

  // Set up a realtime listener for new claims
  useEffect(() => {
    if (!sessionId) return;
    
    console.log("Setting up realtime listener for bingo claims in session:", sessionId);
    
    const claimsChannel = supabase
      .channel('bingo-claims-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bingo_claims',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            console.log("New bingo claim received in realtime:", payload.new);
            
            toast({
              title: "Bingo Claim Received!",
              description: `Player has claimed bingo. Verifying claim...`,
              variant: "default"
            });
            
            // Automatically verify the claim and show the modal
            verifyPendingClaims();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bingo_claims',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.new) {
            console.log("Bingo claim updated:", payload.new);
            
            // Check if any claims need processing
            const timer = setTimeout(() => {
              verifyPendingClaims();
            }, 500);
            return () => clearTimeout(timer);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up bingo claims listener");
      supabase.removeChannel(claimsChannel);
    };
  }, [sessionId, toast, verifyPendingClaims]);

  // Initial check for claims when the component mounts
  useEffect(() => {
    if (sessionId) {
      console.log("INITIAL MOUNT - Checking for pending claims");
      // Short delay to ensure everything is loaded properly
      const timer = setTimeout(() => {
        verifyPendingClaims();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sessionId, verifyPendingClaims]);

  return {
    showClaimModal,
    setShowClaimModal,
    currentClaim,
    setCurrentClaim,
    verifyPendingClaims,
    checkForClaims,
    claimQueue
  };
}
