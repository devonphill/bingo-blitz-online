import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGameProgression } from './useGameProgression';
import { CurrentGameState } from '@/types';

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
  const { progressToNextGame, isProcessingGame } = useGameProgression(
    sessionId ? { id: sessionId } as any : null, 
    () => {
      console.log("Session completed callback triggered");
      toast({
        title: "Session Completed",
        description: "All games in this session have been completed.",
      });
    }
  );

  const handleCloseSheet = useCallback(() => {
    console.log("Closing claim sheet");
    setShowClaimSheet(false);
  }, []);

  const processNextClaim = useCallback(async () => {
    if (claimQueue.length === 0 || processingClaim || showClaimSheet) {
      return;
    }

    setCurrentClaim(null);
    
    setProcessingClaim(true);
    const nextClaim = claimQueue[0];
    
    try {
      console.log(`Processing next claim for ${nextClaim.playerName}`);
      
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', nextClaim.playerId)
        .eq('session_id', sessionId);

      if (ticketError) {
        console.error("Error fetching ticket data:", ticketError);
        setClaimQueue(prev => prev.slice(1));
        setProcessingClaim(false);
        return;
      }

      console.log(`Retrieved ${ticketData?.length || 0} tickets for player ${nextClaim.playerName}`);
      
      setCurrentClaim({
        playerName: nextClaim.playerName,
        playerId: nextClaim.playerId,
        tickets: ticketData || [],
        claimId: nextClaim.claimId
      });
      
      setClaimQueue(prev => prev.slice(1));
      
      console.log("Opening sheet for claim verification!");
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

  const checkForClaims = useCallback(async () => {
    if (!sessionId || hasCheckedInitialClaims.current) return;
    
    console.log("Performing initial check for pending claims");
    hasCheckedInitialClaims.current = true;
    
    try {
      const { data, error } = await supabase
        .from('bingo_claims')
        .select('id, player_id, claimed_at, players(nickname), win_pattern_id')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('claimed_at', { ascending: true });
        
      if (error) {
        console.error("Error fetching pending claims:", error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log("Found pending claims:", data);
        
        data.forEach(claim => {
          const isDuplicate = 
            (currentClaim?.playerId === claim.player_id) || 
            claimQueue.some(q => q.playerId === claim.player_id);
            
          if (!isDuplicate) {
            console.log(`Adding existing claim for ${claim.players?.nickname || 'Unknown'} to queue`);
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

  useEffect(() => {
    if (!showClaimSheet && !processingClaim && claimQueue.length > 0) {
      console.log("Auto-processing next claim");
      const timer = setTimeout(() => {
        processNextClaim();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showClaimSheet, processingClaim, claimQueue, processNextClaim]);

  useEffect(() => {
    if (!sessionId) return;
    
    console.log("Setting up real-time listener for bingo claims");
    
    const channel = supabase
      .channel('caller-claims')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          
          if (payload.payload && payload.payload.playerId && payload.payload.playerName) {
            const claimData = payload.payload;
            
            const isDuplicate = 
              (currentClaim?.playerId === claimData.playerId) || 
              claimQueue.some(q => q.playerId === claimData.playerId);
            
            if (!isDuplicate) {
              console.log(`Adding new claim from ${claimData.playerName} to queue`);
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
              
              if (!showClaimSheet && !processingClaim && !currentClaim) {
                setTimeout(() => {
                  processNextClaim();
                }, 300);
              }
            } else {
              console.log(`Duplicate claim received from ${claimData.playerName}, ignoring`);
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

  const validateClaim = useCallback(async (shouldAdvanceGame = false) => {
    if (!currentClaim || !sessionId) return;
    
    console.log(`Validating claim for ${currentClaim.playerName}, shouldAdvanceGame: ${shouldAdvanceGame}`);
    
    try {
      if (currentClaim.claimId) {
        console.log(`Updating claim ${currentClaim.claimId} status to 'validated'`);
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'validated' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      const { data: sessionProgress } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionProgress) {
        // Update session progress after successful claim validation
        await supabase
          .from('sessions_progress')
          .update({
            current_win_pattern: activeWinPattern || null
          })
          .eq('session_id', sessionId);
      }

      await supabase.channel('player-claims-listener')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: currentClaim.playerId,
            result: 'valid',
            timestamp: new Date().toISOString()
          }
        });
      
      return true;
    } catch (error) {
      console.error("Error validating claim:", error);
      return false;
    }
  }, [currentClaim, sessionId]);

  const rejectClaim = useCallback(async () => {
    if (!currentClaim || !sessionId) return;
    
    console.log(`Rejecting claim for ${currentClaim.playerName}`);
    
    try {
      if (currentClaim.claimId) {
        console.log(`Updating claim ${currentClaim.claimId} status to 'rejected'`);
        const { error: updateError } = await supabase
          .from('bingo_claims')
          .update({ status: 'rejected' })
          .eq('id', currentClaim.claimId);
          
        if (updateError) {
          console.error("Error updating claim status:", updateError);
        }
      }
      
      await supabase.channel('player-claims-listener')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            playerId: currentClaim.playerId,
            result: 'rejected',
            timestamp: new Date().toISOString()
          }
        });
      
      await supabase.channel('player-game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-update',
          payload: { 
            sessionId: sessionId,
            playerId: currentClaim.playerId,
            result: 'false'
          }
        });
      
      toast({
        title: "Claim Rejected",
        description: `${currentClaim.playerName}'s claim has been rejected.`
      });
      
    } catch (error) {
      console.error("Error rejecting claim:", error);
      
      toast({
        title: "Error",
        description: "Failed to reject the claim. Please try again.",
        variant: "destructive"
      });
    }
  }, [currentClaim, sessionId, toast]);

  const handleNextGame = useCallback(() => {
    console.log("Explicitly handling next game progression");
    progressToNextGame();
  }, [progressToNextGame]);

  return {
    showClaimSheet,
    setShowClaimSheet: handleCloseSheet,
    currentClaim,
    setCurrentClaim,
    claimQueue,
    openClaimSheet: useCallback(() => {
      console.log("Opening claim sheet manually");
      if (claimQueue.length > 0 && !currentClaim && !showClaimSheet && !processingClaim) {
        processNextClaim();
      } else if (currentClaim && !showClaimSheet && !processingClaim) {
        setShowClaimSheet(true);
      }
    }, [claimQueue, currentClaim, processNextClaim, showClaimSheet, processingClaim]),
    validateClaim,
    rejectClaim,
    processNextClaim,
    checkForClaims,
    handleNextGame,
    isProcessingGame
  };
}
