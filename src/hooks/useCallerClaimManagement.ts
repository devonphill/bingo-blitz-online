
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Fetch claims initially and set up polling
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`useCallerClaimManagement: Initial fetch for session ${sessionId}`);
    
    // Initial fetch
    const fetchClaims = async () => {
      try {
        const { data, error } = await supabase
          .from('universal_game_logs')
          .select('*')
          .eq('session_id', sessionId)
          .is('validated_at', null)
          .not('claimed_at', 'is', null);
          
        if (error) {
          console.error('Error fetching claims:', error);
          return;
        }
        
        if (data) {
          logWithTimestamp(`useCallerClaimManagement: Found ${data.length} pending claims`);
          setClaims(data);
        }
      } catch (err) {
        console.error('Error fetching claims:', err);
      }
    };
    
    fetchClaims();
    
    // Set up polling interval
    const interval = setInterval(fetchClaims, 5000);
    
    // Subscribe to claim events
    const claimsChannel = supabase
      .channel(`bingo-broadcast`)
      .on('broadcast', { event: 'bingo-claim' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`useCallerClaimManagement: Received bingo claim for session ${sessionId}`);
          
          // Refresh claims when a new claim is received
          fetchClaims();
          
          // Show notification
          toast({
            title: "New Bingo Claim",
            description: `${payload.payload.playerName || 'A player'} has claimed bingo!`,
            duration: 5000,
          });
        }
      })
      .subscribe();
    
    // Cleanup
    return () => {
      clearInterval(interval);
      supabase.removeChannel(claimsChannel);
    };
  }, [sessionId, toast]);
  
  // Validate or reject a claim
  const validateClaim = useCallback((claim: any, isValid: boolean) => {
    if (!sessionId || !claim) {
      console.error('Cannot validate claim: Missing session or claim data');
      return;
    }
    
    setIsProcessingClaim(true);
    
    try {
      logWithTimestamp(`Validating claim ${claim.id} as ${isValid ? 'valid' : 'invalid'}`);
      
      // Use the connection manager to validate the claim
      connectionManager.validateClaim(claim, isValid);
      
      // Update local state to remove the claim
      setClaims(prevClaims => prevClaims.filter(c => c.id !== claim.id));
      
      // Show toast
      toast({
        title: isValid ? "Claim Verified" : "Claim Rejected",
        description: isValid ? "The winning claim has been verified!" : "The claim has been rejected.",
        duration: 3000,
      });
      
      setIsProcessingClaim(false);
    } catch (error) {
      console.error('Error validating claim:', error);
      setIsProcessingClaim(false);
      
      toast({
        title: "Error",
        description: "Failed to process claim. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [sessionId, toast]);
  
  return {
    claims,
    validateClaim,
    isProcessingClaim
  };
}
