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

  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim || showClaimModal) {
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
      
      console.log("Opening modal for claim verification!");
      setShowClaimModal(true);
    } catch (error) {
      console.error("Error processing next claim:", error);
      setClaimQueue(prev => prev.slice(1));
    } finally {
      setProcessingClaim(false);
    }
  }, [claimQueue, processingClaim, sessionId, toast, showClaimModal]);

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
        
        for (const claim of data) {
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

          if (!playerData) {
            console.error(`No player data found for claim ${claim.id}`);
            continue;
          }

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

  useEffect(() => {
    if (!sessionId) return;
    
    verifyPendingClaims();
    
    const intervalId = setInterval(() => {
      verifyPendingClaims();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [sessionId, verifyPendingClaims]);

  useEffect(() => {
    if (!sessionId) return;
    
    const channel = supabase
      .channel('caller-claims')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        ({ payload }) => {
          console.log("Received bingo claim:", payload);
          verifyPendingClaims();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, verifyPendingClaims]);

  useEffect(() => {
    if (!showClaimModal && !currentClaim && claimQueue.length > 0 && !processingClaim) {
      processNextClaim();
    }
  }, [claimQueue, showClaimModal, currentClaim, processingClaim, processNextClaim]);

  const checkForClaims = useCallback(() => {
    console.log("Manual claim check button pressed! - DIRECT CALL");
    verifyPendingClaims();
  }, [verifyPendingClaims]);

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
