
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';

export function useBingoSync(sessionId: string, playerId: string, playerName: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const { toast } = useToast();
  
  // Store channel reference
  const channelRef = useRef<any>(null);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);
  
  // Reconnect function
  const reconnect = useCallback(() => {
    logWithTimestamp(`[useBingoSync] Attempting to reconnect for sessionId ${sessionId}, playerId ${playerId}`);
    setConnectionState('connecting');
    
    // Remove existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Set up a new connection
    if (sessionId && playerId) {
      setupConnection();
    }
  }, [sessionId, playerId]);

  // Set up connection
  const setupConnection = useCallback(() => {
    if (!sessionId || !playerId) {
      logWithTimestamp(`[useBingoSync] Cannot setup connection without sessionId and playerId`);
      setConnectionState('error');
      setConnectionError('Missing session ID or player ID');
      return;
    }
    
    logWithTimestamp(`[useBingoSync] Setting up connection for sessionId ${sessionId}, playerId ${playerId}`);
    setConnectionState('connecting');
    
    // Create a new channel with presence support
    const channel = supabase.channel(`game-${sessionId}`, {
      config: {
        presence: {
          key: playerId,
        },
      },
    });
    
    // Track user presence state
    const presenceState = {
      user_id: playerId,
      name: playerName || playerId,
      online_at: new Date().toISOString(),
      session_id: sessionId
    };

    // Listen for game events
    channel
      .on('broadcast', { event: 'number-called' }, payload => {
        logWithTimestamp(`[useBingoSync] Number called event received: ${JSON.stringify(payload.payload)}`);
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prevState => ({
            ...prevState,
            lastCalledNumber: payload.payload.lastCalledNumber,
            calledNumbers: payload.payload.calledNumbers || prevState?.calledNumbers || []
          }));
          setIsConnected(true);
          setConnectionState('connected');
        }
      })
      .on('broadcast', { event: 'game-update' }, payload => {
        logWithTimestamp(`[useBingoSync] Game update received: ${JSON.stringify(payload.payload)}`);
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prevState => ({
            ...prevState,
            ...payload.payload
          }));
          setIsConnected(true);
          setConnectionState('connected');
        }
      })
      .on('broadcast', { event: 'pattern-change' }, payload => {
        logWithTimestamp(`[useBingoSync] Pattern change event received: ${JSON.stringify(payload.payload)}`);
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prevState => ({
            ...prevState,
            currentWinPattern: payload.payload.pattern,
            currentPrize: payload.payload.prize
          }));
          setIsConnected(true);
          setConnectionState('connected');
          
          toast({
            title: "Win Pattern Changed",
            description: `The current pattern is now: ${payload.payload.pattern}`,
            duration: 5000
          });
        }
      })
      .on('broadcast', { event: 'claim-result' }, payload => {
        logWithTimestamp(`[useBingoSync] Claim result received: ${JSON.stringify(payload.payload)}`);
        
        // Check if this result is for our player
        if (payload.payload?.playerId === playerId) {
          const isValid = payload.payload?.result === 'valid';
          
          toast({
            title: isValid ? "Bingo Validated!" : "Claim Rejected",
            description: isValid 
              ? "Your bingo claim has been verified by the caller"
              : "Your claim was rejected by the caller",
            variant: isValid ? "default" : "destructive",
            duration: 5000
          });
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        logWithTimestamp(`[useBingoSync] Presence sync: ${JSON.stringify(state)}`);
        setIsConnected(true);
        setConnectionState('connected');
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        logWithTimestamp(`[useBingoSync] Presence join: ${JSON.stringify(newPresences)}`);
        setIsConnected(true);
        setConnectionState('connected');
      })
      .subscribe(status => {
        logWithTimestamp(`[useBingoSync] Channel subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setConnectionError(null);
          
          // Once subscribed, track presence
          channel.track(presenceState).then(() => {
            logWithTimestamp(`[useBingoSync] Tracked presence for ${playerId}`);
          });
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setConnectionState('error');
          setConnectionError('Channel error');
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setConnectionState('error');
          setConnectionError('Connection timed out');
        }
      });
    
    // Save channel reference
    channelRef.current = channel;
    
    // Set up a heartbeat for presence
    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.track(presenceState).catch(error => {
          console.error('Error updating presence:', error);
        });
      }
    }, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(heartbeatInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, playerId, playerName, toast]);

  // Initialize connection
  useEffect(() => {
    if (sessionId && playerId) {
      const cleanup = setupConnection();
      return cleanup;
    }
  }, [sessionId, playerId, setupConnection]);

  // Submit bingo claim
  const claimBingo = useCallback(async (ticketData: any) => {
    if (!sessionId || !playerId) {
      logWithTimestamp(`[useBingoSync] Cannot claim bingo without sessionId and playerId`);
      return false;
    }
    
    try {
      logWithTimestamp(`[useBingoSync] Claiming bingo for sessionId ${sessionId}, playerId ${playerId}`);
      
      // Check if playerId is a UUID or a player code
      let actualPlayerId = playerId;
      let actualPlayerName = playerName || playerId;
      
      // If playerId doesn't look like a UUID (contains letters and is short), assume it's a player code
      // and try to find the actual UUID
      if (playerId.length < 30 && /[A-Za-z]/.test(playerId)) {
        // Query for the player by player_code
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerId)
          .single();
          
        if (playerError) {
          console.error("Error finding player by player code:", playerError);
          toast({
            title: "Claim Error",
            description: `Could not verify player identity: ${playerError.message}`,
            variant: "destructive"
          });
          return false;
        }
        
        if (playerData) {
          logWithTimestamp(`[useBingoSync] Found player UUID ${playerData.id} for player code ${playerId}`);
          actualPlayerId = playerData.id;
          actualPlayerName = playerData.nickname || playerName || playerId;
        }
      }
      
      // First add the claim to the universal_game_logs table
      const { data, error } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          player_id: actualPlayerId,
          player_name: actualPlayerName,
          game_type: 'mainstage',
          game_number: gameState?.currentGameNumber || 1, // Add game number field - required
          win_pattern: gameState?.currentWinPattern || 'oneLine',
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          called_numbers: gameState?.calledNumbers || [],
          last_called_number: gameState?.lastCalledNumber,
          total_calls: (gameState?.calledNumbers || []).length,
          claimed_at: new Date().toISOString(),
          validated_at: null // This will be set by the caller when validated
        });
      
      if (error) {
        console.error("Error logging claim:", error);
        toast({
          title: "Claim Error",
          description: `Failed to submit claim: ${error.message}`,
          variant: "destructive"
        });
        return false;
      }
      
      // Once logged successfully, broadcast the claim
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            sessionId,
            playerId: actualPlayerId,
            playerName: actualPlayerName,
            ticketData: {
              serial: ticketData.serial,
              perm: ticketData.perm,
              position: ticketData.position,
              layoutMask: ticketData.layoutMask || ticketData.layout_mask,
              numbers: ticketData.numbers
            },
            timestamp: new Date().toISOString()
          }
        });
      }
      
      toast({
        title: "Claim Submitted",
        description: "Your bingo claim has been sent to the caller for verification",
        duration: 5000
      });
      
      return true;
    } catch (error) {
      console.error("Error submitting claim:", error);
      return false;
    }
  }, [sessionId, playerId, playerName, gameState, toast]);

  return {
    isConnected,
    connectionState,
    connectionError,
    gameState,
    reconnect,
    claimBingo
  };
}
