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
        // Fix: Use correct LogLevel parameter format
        logWithTimestamp('Received bingo claim broadcast:', 'info', 'Connection');
        if (payload.payload && payload.payload.sessionId === sessionId) {
          toast({
            title: "New Bingo Claim!",
            description: `${payload.payload.playerName || payload.payload.playerId} has claimed bingo! Check the claims panel.`,
          });
          fetchPendingClaims();
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`Caller hub connection status: ${status}`, 'info');
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
      logWithTimestamp(`Fetching pending claims for session ${sessionId}`, 'info');
      
      // Query universal_game_logs table for unvalidated claims
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);  // Make sure we only get claims
      
      if (error) {
        console.error('Error fetching pending claims:', error);
        setConnectionState('error');
        return;
      }
      
      if (data && Array.isArray(data)) {
        logWithTimestamp(`Found ${data.length} pending claims`, 'info');
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
  const respondToClaim = useCallback(async (claimId: string, playerId: string, isValid: boolean) => {
    if (!sessionId || !playerId) return false;
    
    setIsProcessing(true);
    try {
      logWithTimestamp(`Responding to claim from player ${playerId} with result: ${isValid ? 'valid' : 'rejected'}`, 'info');
      
      // Update the claim in the database
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ 
          validated_at: new Date().toISOString(),
          prize_shared: isValid ? true : false  // Only share prize if valid
        })
        .eq('id', claimId);
      
      if (error) {
        console.error('Error updating claim:', error);
        toast({
          title: "Error",
          description: `Failed to update claim: ${error.message}`,
          variant: "destructive"
        });
        return false;
      }
      
      // Broadcast the result to the player
      await sendBroadcast('claim-result', { 
        playerId: playerId,
        result: isValid ? 'valid' : 'rejected'
      });
      
      toast({
        title: isValid ? "Claim Validated" : "Claim Rejected",
        description: isValid 
          ? "The claim has been validated successfully" 
          : "The claim has been rejected"
      });
      
      // Refresh the pending claims list
      await fetchPendingClaims();
      
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
  }, [sessionId, fetchPendingClaims, toast]);
  
  // Change the current active win pattern
  const changePattern = useCallback(async (patternId: string) => {
    if (!sessionId) return false;
    
    try {
      logWithTimestamp(`Changing win pattern to ${patternId}`, 'info');
      
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
      await sendBroadcast('pattern-change', { 
        sessionId,
        pattern: patternId
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
      logWithTimestamp(`Starting game for session ${sessionId}`, 'info');
      
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
      await sendBroadcast('game-start', { 
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (err) {
      console.error('Error starting game:', err);
      return false;
    }
  }, [sessionId]);

  // Add reconnect method
  const reconnect = useCallback(() => {
    logWithTimestamp("Manually reconnecting caller hub", 'info');
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

// Add proper typing for the event and a proper channel variable
// Create a function with channel as a parameter so it's available in the scope
const sendBroadcast = async (event: string, payload: any) => {
  // Create a new channel for each broadcast to avoid the channel not found error
  const broadcastChannel = supabase.channel('broadcast-channel');
  
  try {
    // Log with proper LogLevel type
    logWithTimestamp('Sending broadcast message', 'info');
    
    await broadcastChannel.send({
      type: 'broadcast',
      event: event,
      payload: payload
    });
    
    // Clean up the channel after use
    supabase.removeChannel(broadcastChannel);
    return true;
  } catch (err) {
    console.error(`Error sending broadcast ${event}:`, err);
    // Clean up the channel even if there's an error
    supabase.removeChannel(broadcastChannel);
    return false;
  }
};
