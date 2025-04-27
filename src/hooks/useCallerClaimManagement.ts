
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useCallerClaimManagement(sessionId: string | undefined) {
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  const fetchPendingClaims = useCallback(async () => {
    if (!sessionId) return [];
    
    try {
      // We store claims in universal_game_logs table with player_id and session_id
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
        
      if (error) {
        console.error("Error fetching pending claims:", error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error("Exception fetching pending claims:", err);
      return [];
    }
  }, [sessionId]);

  const validateClaim = useCallback(async (claimId: string, playerId: string) => {
    if (!sessionId) return false;
    
    setIsProcessingClaim(true);
    try {
      // Update the claim in universal_game_logs
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', claimId);
        
      if (error) {
        console.error("Error validating claim:", error);
        toast({
          title: "Error",
          description: "Failed to validate claim.",
          variant: "destructive"
        });
        return false;
      }
      
      // Broadcast the result to the player
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId,
            result: 'valid'
          }
        });
      
      toast({
        title: "Claim Validated",
        description: "The claim has been validated successfully."
      });
      
      // Refresh the pending claims list
      setPendingClaims(await fetchPendingClaims());
      
      return true;
    } catch (err) {
      console.error("Error during claim validation:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred during validation.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, fetchPendingClaims, toast]);

  const rejectClaim = useCallback(async (claimId: string, playerId: string) => {
    if (!sessionId) return false;
    
    setIsProcessingClaim(true);
    try {
      // Delete the claim from universal_game_logs (or mark as rejected)
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ validated_at: new Date().toISOString(), prize_shared: false })
        .eq('id', claimId);
        
      if (error) {
        console.error("Error rejecting claim:", error);
        toast({
          title: "Error",
          description: "Failed to reject claim.",
          variant: "destructive"
        });
        return false;
      }
      
      // Broadcast the result to the player
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId,
            result: 'rejected'
          }
        });
      
      toast({
        title: "Claim Rejected",
        description: "The claim has been rejected."
      });
      
      // Refresh the pending claims list
      setPendingClaims(await fetchPendingClaims());
      
      return true;
    } catch (err) {
      console.error("Error during claim rejection:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred during rejection.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, fetchPendingClaims, toast]);

  // Fetch pending claims on mount
  useEffect(() => {
    const loadClaims = async () => {
      const claims = await fetchPendingClaims();
      setPendingClaims(claims);
    };
    
    if (sessionId) {
      loadClaims();
    }
  }, [sessionId, fetchPendingClaims]);

  // Listen for new claims
  useEffect(() => {
    if (!sessionId) return;
    
    const channel = supabase
      .channel('caller-claims-listener')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        async (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          if (payload.payload && payload.payload.sessionId === sessionId) {
            toast({
              title: "New Bingo Claim!",
              description: `${payload.payload.playerName} has claimed bingo! Check the claims panel to verify.`,
              variant: "default",
            });
            
            const claims = await fetchPendingClaims();
            setPendingClaims(claims);
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchPendingClaims, toast]);

  return {
    pendingClaims,
    isProcessingClaim,
    validateClaim,
    rejectClaim,
    fetchPendingClaims
  };
}
