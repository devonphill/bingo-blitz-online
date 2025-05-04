
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerClaimManagement(sessionId: string | null) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<any>(null);
  const { toast } = useToast();
  
  // Set up listener for bingo claims
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`Setting up bingo claim listener for session ${sessionId}`);
    
    // Create a dedicated channel for bingo claims
    const claimsChannel = supabase.channel('bingo-broadcast');
    
    claimsChannel
      .on('broadcast', { event: 'bingo-claim' }, payload => {
        // Only process claims for this session
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received bingo claim for session ${sessionId}`);
          console.log('Claim data:', payload.payload);
          
          // Add the claim to our list
          setClaims(prev => [...prev, payload.payload]);
          
          // Show a toast notification
          toast({
            title: "New Bingo Claim!",
            description: `${payload.payload.playerName} has claimed bingo!`,
            duration: 5000,
          });
        }
      })
      .subscribe();
      
    // Also set up a channel for claim results
    const resultsChannel = supabase.channel(`claim-results-${sessionId}`);
    resultsChannel.subscribe();
    
    // Cleanup on unmount
    return () => {
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(resultsChannel);
    };
  }, [sessionId, toast]);
  
  // Function to validate a claim
  const validateClaim = useCallback((claim: any, isValid: boolean) => {
    if (!sessionId || !claim) return;
    
    setIsProcessingClaim(true);
    setCurrentClaim(claim);
    
    try {
      logWithTimestamp(`Processing claim ${claim.id} for player ${claim.playerId}`);
      
      // Create a channel for sending claim results
      const resultsChannel = supabase.channel(`claim-results-${sessionId}`);
      
      // Prepare the result payload
      const resultPayload = {
        claimId: claim.id,
        sessionId: sessionId,
        playerId: claim.playerId,
        result: isValid ? 'valid' : 'invalid',
        timestamp: new Date().toISOString(),
        validatedBy: 'caller'
      };
      
      logWithTimestamp(`Broadcasting claim result: ${JSON.stringify(resultPayload)}`);
      
      // Broadcast the result
      resultsChannel.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: resultPayload
      }).then(() => {
        logWithTimestamp(`Claim result broadcast successfully`);
        
        // Remove the claim from our list
        setClaims(prev => prev.filter(c => c.id !== claim.id));
        
        // Show a toast notification
        toast({
          title: isValid ? "Bingo Verified!" : "Claim Rejected",
          description: isValid 
            ? `${claim.playerName}'s bingo claim has been verified!` 
            : `${claim.playerName}'s bingo claim was rejected.`,
          duration: 5000,
        });
        
        // Also broadcast to the general claims channel
        supabase.channel('bingo-broadcast').send({
          type: 'broadcast',
          event: 'claim-result',
          payload: resultPayload
        });
        
      }).catch(error => {
        console.error('Error broadcasting claim result:', error);
        toast({
          title: "Error",
          description: "Failed to process the bingo claim.",
          variant: "destructive"
        });
      }).finally(() => {
        setIsProcessingClaim(false);
        setCurrentClaim(null);
      });
      
    } catch (error) {
      console.error('Error processing claim:', error);
      setIsProcessingClaim(false);
      setCurrentClaim(null);
    }
  }, [sessionId, toast]);
  
  // Function to fetch claims from the database
  const fetchClaims = useCallback(async () => {
    if (!sessionId) return [];
    
    try {
      // Fetch claims for this session
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
        
      if (error) {
        console.error('Error fetching claims:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching claims:', error);
      return [];
    }
  }, [sessionId]);
  
  return {
    claims,
    isProcessingClaim,
    currentClaim,
    validateClaim,
    fetchClaims
  };
}
