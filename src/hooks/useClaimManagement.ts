
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useClaimManagement(sessionId: string | undefined) {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<{
    playerName: string;
    playerId: string;
    tickets: any[];
  } | null>(null);
  const { toast } = useToast();

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

      if (!data || data.length === 0) {
        console.log("No pending claims found");
        
        // Directly open empty modal even without claims
        console.log("No pending claims, but opening modal anyway...");
        setCurrentClaim({
          playerName: "No pending claims",
          playerId: "",
          tickets: []
        });
        setShowClaimModal(true);
        return;
      }

      console.log("Found pending claims:", data);
      const latestClaim = data[0];

      // Fetch player details
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('nickname, id, email')
        .eq('id', latestClaim.player_id)
        .single();

      if (playerError) {
        console.error("Error fetching player data:", playerError);
        toast({
          title: "Error",
          description: "Failed to fetch player information.",
          variant: "destructive"
        });
        return;
      }

      // Fetch player's tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', playerData.id)
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

      console.log("Setting current claim with tickets:", ticketData);
      setCurrentClaim({
        playerName: playerData.nickname,
        playerId: playerData.id,
        tickets: ticketData
      });
      
      // Explicitly open the modal and force to true
      console.log("Opening claim modal NOW!");
      setShowClaimModal(true);
    } catch (error) {
      console.error("Error in verifyPendingClaims:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while checking claims.",
        variant: "destructive"
      });
    }
  }, [sessionId, toast]);

  const checkForClaims = useCallback(() => {
    console.log("Manual claim check button pressed!");
    verifyPendingClaims();
  }, [verifyPendingClaims]);

  return {
    showClaimModal,
    setShowClaimModal,
    currentClaim,
    setCurrentClaim,
    verifyPendingClaims,
    checkForClaims
  };
}
