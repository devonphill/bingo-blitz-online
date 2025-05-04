
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
          setClaims(prev => {
            // Check if claim already exists
            const exists = prev.some(c => 
              c.id === payload.payload.id || 
              (c.playerId === payload.payload.playerId && c.timestamp === payload.payload.timestamp)
            );
            if (exists) {
              return prev;
            }
            return [...prev, payload.payload];
          });
          
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
    
    // Set up initial fetch of pending claims
    fetchClaims().then(fetchedClaims => {
      if (fetchedClaims.length > 0) {
        logWithTimestamp(`Loaded ${fetchedClaims.length} existing claims from database`);
        setClaims(fetchedClaims);
      }
    });
    
    // Set up polling for new claims
    const pollingInterval = setInterval(() => {
      fetchClaims().then(fetchedClaims => {
        if (fetchedClaims.length > 0) {
          setClaims(prev => {
            // Merge with existing claims, avoiding duplicates
            const existingIds = new Set(prev.map(c => c.id));
            const newClaims = fetchedClaims.filter(c => !existingIds.has(c.id));
            
            if (newClaims.length > 0) {
              logWithTimestamp(`Found ${newClaims.length} new claims during polling`);
              
              // Show notification for new claims
              if (newClaims.length === 1) {
                toast({
                  title: "New Bingo Claim!",
                  description: `${newClaims[0].player_name} has claimed bingo!`,
                  duration: 5000,
                });
              } else if (newClaims.length > 1) {
                toast({
                  title: "New Bingo Claims!",
                  description: `${newClaims.length} new claims have been submitted.`,
                  duration: 5000,
                });
              }
              
              return [...prev, ...newClaims];
            }
            return prev;
          });
        }
      });
    }, 5000); // Poll every 5 seconds
    
    // Cleanup on unmount
    return () => {
      supabase.removeChannel(claimsChannel);
      supabase.removeChannel(resultsChannel);
      clearInterval(pollingInterval);
    };
  }, [sessionId, toast]);
  
  // Function to validate a claim
  const validateClaim = useCallback(async (claim: any, isValid: boolean) => {
    if (!sessionId || !claim) return;
    
    setIsProcessingClaim(true);
    setCurrentClaim(claim);
    
    try {
      logWithTimestamp(`Processing claim ${claim.id} for player ${claim.playerId || claim.player_id}`);
      
      // Normalize claim data
      const normalizedClaim = {
        id: claim.id,
        playerId: claim.playerId || claim.player_id,
        playerName: claim.playerName || claim.player_name,
        sessionId: claim.sessionId || claim.session_id || sessionId,
      };
      
      // Create a channel for sending claim results
      const resultsChannel = supabase.channel(`claim-results-${sessionId}`);
      
      // Prepare the result payload
      const resultPayload = {
        claimId: normalizedClaim.id,
        sessionId: sessionId,
        playerId: normalizedClaim.playerId,
        result: isValid ? 'valid' : 'invalid',
        timestamp: new Date().toISOString(),
        validatedBy: 'caller'
      };
      
      logWithTimestamp(`Broadcasting claim result: ${JSON.stringify(resultPayload)}`);
      
      // Update the database record first for persistence
      const { error: dbError } = await supabase
        .from('universal_game_logs')
        .update({
          validated_at: new Date().toISOString(),
          validator_decision: isValid ? 'valid' : 'invalid'
        })
        .eq('id', normalizedClaim.id);
        
      if (dbError) {
        console.error('Error updating claim in database:', dbError);
        toast({
          title: "Database Error",
          description: "Failed to update claim status in database.",
          variant: "destructive"
        });
        return;
      }
      
      // Broadcast the result
      await resultsChannel.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: resultPayload
      });
      
      logWithTimestamp(`Claim result broadcast successfully`);
      
      // Remove the claim from our list
      setClaims(prev => prev.filter(c => c.id !== normalizedClaim.id));
      
      // Show a toast notification
      toast({
        title: isValid ? "Bingo Verified!" : "Claim Rejected",
        description: isValid 
          ? `${normalizedClaim.playerName}'s bingo claim has been verified!` 
          : `${normalizedClaim.playerName}'s bingo claim was rejected.`,
        duration: 5000,
      });
      
      // Also broadcast to the general claims channel
      await supabase.channel('bingo-broadcast').send({
        type: 'broadcast',
        event: 'claim-result',
        payload: resultPayload
      });
      
      // If claim is valid, advance the game (this will move to the next pattern or game)
      if (isValid) {
        // Update the session progress
        const { error: progressError } = await supabase
          .from('sessions_progress')
          .update({
            game_status: 'won'
          })
          .eq('session_id', sessionId);
          
        if (progressError) {
          console.error('Error updating session progress:', progressError);
        }
        
        // Broadcast game advancement notification
        await supabase.channel('bingo-broadcast').send({
          type: 'broadcast',
          event: 'game-advanced',
          payload: {
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            reason: 'claim_verified',
            claimId: normalizedClaim.id
          }
        });
      }
      
    } catch (error) {
      console.error('Error processing claim:', error);
      toast({
        title: "Error",
        description: "Failed to process the bingo claim.",
        variant: "destructive"
      });
    } finally {
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
