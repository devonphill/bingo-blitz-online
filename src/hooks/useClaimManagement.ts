
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
        toast({
          title: "Error",
          description: "Failed to fetch ticket information.",
          variant: "destructive"
        });
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
  }, [claimQueue, processingClaim, sessionId, toast, showClaimSheet]);

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
              
              // Notify caller about the new claim
              toast({
                title: "New Claim!",
                description: `${claimData.playerName} has claimed a win!`,
                variant: "default"
              });
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
  }, [sessionId, toast, currentClaim, claimQueue]);

  // Process next claim if available
  useEffect(() => {
    if (!showClaimSheet && !currentClaim && claimQueue.length > 0 && !processingClaim) {
      processNextClaim();
    }
  }, [claimQueue, showClaimSheet, currentClaim, processingClaim, processNextClaim]);

  // Manually check for claims
  const checkForClaims = useCallback(() => {
    console.log("Manual claim check requested");
    toast({
      title: "Checking claims",
      description: "Verifying if there are any pending claims..."
    });
    
    // If we have claims in the local queue, process them
    if (claimQueue.length > 0 && !currentClaim && !showClaimSheet) {
      processNextClaim();
    }
  }, [claimQueue.length, currentClaim, showClaimSheet, processNextClaim, toast]);

  // Function to broadcast a claim (used by players)
  const broadcastClaim = useCallback(async (playerName: string, playerId: string) => {
    if (!sessionId) return;
    
    console.log("Broadcasting claim for player:", playerName);
    
    try {
      // The error property is now gone from the response, as it's handled differently
      await supabase
        .channel('caller-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: { 
            playerId, 
            playerName,
            sessionId,
            timestamp: new Date().toISOString()
          }
        });
      
      return true;
    } catch (error) {
      console.error("Exception in broadcastClaim:", error);
      return false;
    }
  }, [sessionId]);

  return {
    showClaimSheet,
    setShowClaimSheet,
    currentClaim,
    setCurrentClaim,
    checkForClaims,
    claimQueue,
    broadcastClaim
  };
}
