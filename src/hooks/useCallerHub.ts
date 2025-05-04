
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useCallerHub(sessionId: string | undefined) {
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const { toast } = useToast();

  // Fetch pending claims on mount and periodically
  useEffect(() => {
    if (!sessionId) return;
    
    // Initial fetch
    fetchPendingClaims();
    setConnectionState('connecting');
    
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
        setConnectionState(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });
      
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      setConnectionState('disconnected');
    };
  }, [sessionId, toast]);
  
  // Fetch pending claims from database
  const fetchPendingClaims = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      logWithTimestamp(`Fetching pending claims for session ${sessionId}`);
      
      // Use the RPC function to get pending claims - updated to use direct query instead of RPC
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null);
      
      if (error) {
        console.error('Error fetching pending claims:', error);
        setConnectionState('error');
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
      setConnectionState('error');
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

  // Start a new game (added method)
  const startGame = useCallback(async () => {
    if (!sessionId) return false;
    
    try {
      logWithTimestamp(`Starting game for session ${sessionId}`);
      
      // Update the database to mark the game as active
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          status: 'active',
          lifecycle_state: 'live'
        })
        .eq('id', sessionId);
        
      if (error) {
        console.error('Error starting game:', error);
        return false;
      }
      
      // Broadcast the game start event
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'game-start',
          payload: { 
            sessionId,
            timestamp: new Date().toISOString()
          }
        });
      
      return true;
    } catch (err) {
      console.error('Error starting game:', err);
      return false;
    }
  }, [sessionId]);

  // Add reconnect method
  const reconnect = useCallback(() => {
    logWithTimestamp("Manually reconnecting caller hub");
    setConnectionState('connecting');
    fetchPendingClaims();
  }, [fetchPendingClaims]);

  return {
    pendingClaims,
    isProcessing,
    isConnected,
    connectionState,
    fetchPendingClaims,
    respondToClaim,
    changePattern,
    startGame,
    reconnect
  };
}
