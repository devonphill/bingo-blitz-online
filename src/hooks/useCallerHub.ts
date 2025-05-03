
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerHub(sessionId: string | undefined) {
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Fetch pending claims on mount and periodically
  useEffect(() => {
    if (!sessionId) return;
    
    // Initial fetch
    fetchPendingClaims();
    
    // Set up polling
    const interval = setInterval(fetchPendingClaims, 5000);
    
    // Listen for new claims via broadcast channel
    const channel = supabase
      .channel('caller-claims-channel')
      .on('broadcast', { event: 'bingo-claim' }, payload => {
        logWithTimestamp('Received bingo claim broadcast:', payload);
        if (payload.payload && payload.payload.sessionId === sessionId) {
          toast({
            title: "New Bingo Claim!",
            description: `${payload.payload.playerName} has claimed bingo! Check the claims panel.`,
          });
          fetchPendingClaims();
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`Caller hub connection status: ${status}`);
        setIsConnected(status === 'SUBSCRIBED');
      });
      
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);
  
  // Fetch pending claims from database
  const fetchPendingClaims = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp(`Fetching pending claims for session ${sessionId}`);
      
      // Use the RPC function to get pending claims
      const { data, error } = await supabase.rpc(
        'get_pending_claims',
        { p_session_id: sessionId }
      );
      
      if (error) {
        console.error('Error fetching pending claims:', error);
        return;
      }
      
      if (data && Array.isArray(data)) {
        logWithTimestamp(`Found ${data.length} pending claims`);
        setPendingClaims(data);
        
        // If there are claims and we haven't shown a notification recently, show one
        if (data.length > 0) {
          toast({
            title: `${data.length} Pending Claims`,
            description: "Check the claims panel to verify these claims",
            duration: 5000,
          });
        }
      }
    } catch (err) {
      console.error('Exception in fetchPendingClaims:', err);
    }
  }, [sessionId, toast]);
  
  // Respond to a claim (valid or rejected)
  const respondToClaim = useCallback(async (playerCode: string, result: 'valid' | 'rejected') => {
    if (!sessionId || !playerCode) return false;
    
    setIsProcessing(true);
    try {
      logWithTimestamp(`Responding to claim from player ${playerCode} with result: ${result}`);
      
      // Broadcast the result to the player
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: playerCode,
            result
          }
        });
      
      // Remove the claim from pending claims
      setPendingClaims(prev => prev.filter(claim => claim.player_id !== playerCode));
      
      toast({
        title: result === 'valid' ? "Claim Validated" : "Claim Rejected",
        description: result === 'valid' 
          ? "The claim has been validated successfully" 
          : "The claim has been rejected"
      });
      
      return true;
    } catch (err) {
      console.error('Error responding to claim:', err);
      toast({
        title: "Error",
        description: "Failed to respond to claim",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, toast]);
  
  // Change the current active win pattern
  const changePattern = useCallback(async (patternId: string) => {
    if (!sessionId) return false;
    
    try {
      logWithTimestamp(`Changing win pattern to ${patternId}`);
      
      // Update the database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ current_win_pattern: patternId })
        .eq('session_id', sessionId);
        
      if (error) {
        console.error('Error updating win pattern:', error);
        return false;
      }
      
      // Broadcast the pattern change
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'pattern-change',
          payload: { 
            sessionId,
            pattern: patternId
          }
        });
      
      return true;
    } catch (err) {
      console.error('Error changing pattern:', err);
      return false;
    }
  }, [sessionId]);

  return {
    pendingClaims,
    isProcessing,
    isConnected,
    fetchPendingClaims,
    respondToClaim,
    changePattern
  };
}
