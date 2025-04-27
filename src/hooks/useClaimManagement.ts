import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SessionProgress } from '@/types';

export function useClaimManagement(sessionId: string | undefined, gameNumber: number | undefined) {
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const { toast } = useToast();

  const fetchPendingClaims = useCallback(async () => {
    if (!sessionId || !gameNumber) return [];
    
    try {
      // Use universal_game_logs instead of bingo_claims
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .eq('game_number', gameNumber)
        .eq('status', 'pending');
        
      if (error) {
        console.error("Error fetching claims:", error);
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error("Error in fetchPendingClaims:", err);
      return [];
    }
  }, [sessionId, gameNumber]);

  useEffect(() => {
    fetchPendingClaims().then(claims => setPendingClaims(claims));
  }, [fetchPendingClaims]);

  const validateClaim = useCallback(async (claimId: string, playerId: string) => {
    if (!sessionId || !gameNumber) return false;

    setIsProcessingClaim(true);
    try {
      // Fetch player info
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) {
        console.error("Error fetching player data:", playerError);
        toast({
          title: "Error",
          description: "Failed to fetch player data.",
          variant: "destructive"
        });
        return false;
      }

      // Fetch session info
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error("Error fetching session data:", sessionError);
        toast({
          title: "Error",
          description: "Failed to fetch session data.",
          variant: "destructive"
        });
        return false;
      }

      // Update the claim status in universal_game_logs
      const { error: updateError } = await supabase
        .from('universal_game_logs')
        .update({ status: 'validated', validated_at: new Date().toISOString() })
        .eq('id', claimId);

      if (updateError) {
        console.error("Error validating claim:", updateError);
        toast({
          title: "Error",
          description: "Failed to validate claim.",
          variant: "destructive"
        });
        return false;
      }

      // Update local state
      setPendingClaims(prev => prev.filter(claim => claim.id !== claimId));

      toast({
        title: "Claim Validated",
        description: "The claim has been successfully validated.",
      });
      return true;
    } catch (err) {
      console.error("Error in validateClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while validating the claim.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, gameNumber, toast]);

  const rejectClaim = useCallback(async (claimId: string) => {
    if (!sessionId || !gameNumber) return false;

    setIsProcessingClaim(true);
    try {
      // Update the claim status to 'rejected' in universal_game_logs
      const { error: updateError } = await supabase
        .from('universal_game_logs')
        .update({ status: 'rejected' })
        .eq('id', claimId);

      if (updateError) {
        console.error("Error rejecting claim:", updateError);
        toast({
          title: "Error",
          description: "Failed to reject claim.",
          variant: "destructive"
        });
        return false;
      }

      // Update local state
      setPendingClaims(prev => prev.filter(claim => claim.id !== claimId));

      toast({
        title: "Claim Rejected",
        description: "The claim has been successfully rejected.",
      });
      return true;
    } catch (err) {
      console.error("Error in rejectClaim:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while rejecting the claim.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessingClaim(false);
    }
  }, [sessionId, gameNumber, toast]);

  return {
    pendingClaims,
    fetchPendingClaims,
    validateClaim,
    rejectClaim,
    isProcessingClaim
  };
}
