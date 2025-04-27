
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePlayerGame(playerId: string | undefined, sessionId: string | undefined) {
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  const { toast } = useToast();

  const submitClaim = useCallback(async (
    winPatternId: string,
    ticketData: {
      serial: string;
      numbers: number[];
      layoutMask?: number;
      perm?: number;
      position?: number;
    }
  ) => {
    if (!playerId || !sessionId) return false;
    
    setIsSubmittingClaim(true);
    try {
      // Generate a unique ID for this claim
      const claimId = crypto.randomUUID();
      
      // Get player information
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('nickname')
        .eq('id', playerId)
        .single();
        
      if (playerError || !playerData) {
        console.error("Error fetching player data:", playerError);
        toast({
          title: "Error",
          description: "Could not retrieve player information.",
          variant: "destructive"
        });
        return false;
      }
      
      // Get current session information
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('current_game, game_type, called_items')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData) {
        console.error("Error fetching session data:", sessionError);
        toast({
          title: "Error",
          description: "Could not retrieve game information.",
          variant: "destructive"
        });
        return false;
      }

      // Parse called items
      let calledNumbers: number[] = [];
      let lastCalledNumber: number | null = null;
      
      try {
        if (sessionData.called_items) {
          const parsedItems = typeof sessionData.called_items === 'string' 
            ? JSON.parse(sessionData.called_items) 
            : sessionData.called_items;
          
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            calledNumbers = parsedItems.map(item => item.value);
            lastCalledNumber = parsedItems[parsedItems.length - 1].value;
          }
        }
      } catch (err) {
        console.error("Error parsing called items:", err);
      }

      // Broadcast the claim to the caller
      await supabase.channel('caller-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            playerId,
            playerName: playerData.nickname,
            claimId,
            sessionId,
            ticketData,
            winPatternId,
            timestamp: new Date().toISOString()
          }
        });
      
      // Log the claim in universal_game_logs
      const gameNumber = sessionData.current_game || 1;
      
      await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          game_number: gameNumber,
          player_id: playerId,
          player_name: playerData.nickname,
          win_pattern: winPatternId,
          ticket_serial: ticketData.serial,
          ticket_numbers: ticketData.numbers,
          ticket_layout_mask: ticketData.layoutMask || 0,
          ticket_perm: ticketData.perm || 0,
          ticket_position: ticketData.position || 0,
          claimed_at: new Date().toISOString(),
          game_type: sessionData.game_type || 'mainstage',
          called_numbers: calledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: calledNumbers.length
        });
      
      setClaimStatus('pending');
      
      toast({
        title: "Claim Submitted",
        description: "Your bingo claim has been submitted for verification.",
      });
      
      // Listen for claim result
      setupClaimListener(playerId);
      
      return true;
    } catch (err) {
      console.error("Error submitting bingo claim:", err);
      toast({
        title: "Error",
        description: "Failed to submit your claim. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSubmittingClaim(false);
    }
  }, [playerId, sessionId, toast]);

  const setupClaimListener = useCallback((playerIdToListen: string) => {
    const channel = supabase
      .channel('claim-results')
      .on(
        'broadcast',
        { event: 'claim-result' },
        payload => {
          console.log("Received claim result:", payload);
          if (payload.payload && payload.payload.playerId === playerIdToListen) {
            const result = payload.payload.result;
            
            if (result === 'valid') {
              setClaimStatus('validated');
              toast({
                title: "Claim Validated",
                description: "Your bingo claim has been validated!",
                variant: "default"
              });
            } else if (result === 'rejected') {
              setClaimStatus('rejected');
              toast({
                title: "Claim Rejected",
                description: "Your bingo claim was not valid. Please check your card and try again.",
                variant: "destructive"
              });
            }
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Reset claim status if player or session changes
  useEffect(() => {
    setClaimStatus(null);
  }, [playerId, sessionId]);

  return {
    submitClaim,
    isSubmittingClaim,
    claimStatus
  };
}
