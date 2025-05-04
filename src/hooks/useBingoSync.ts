import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define the connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useBingoSync(playerCode: string | null, sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [gameState, setGameState] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');

  // Keep track of channel subscription
  const channelRef = useRef<any>(null);
  
  // Track connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  
  // Function to reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Simple reconnect function
  const reconnect = useCallback(() => {
    logWithTimestamp(`Manual reconnection requested for player ${playerCode}`);
    
    // Clean up existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        logWithTimestamp(`Removed existing channel for player ${playerCode}`);
      } catch (err) {
        console.error("Error removing channel during reconnect:", err);
      }
    }
    
    // Set state to trigger reconnection in useEffect
    setConnectionState('connecting');
  }, [playerCode]);

  // Set up the connection to the session - simplified logic
  useEffect(() => {
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }

    // Clear error state and set connecting state
    setError('');
    setIsLoading(true);
    setIsConnected(false);
    setConnectionState('connecting');

    logWithTimestamp(`Setting up connection for player ${playerCode} to session ${sessionId}`);
    
    // Generate a unique channel name
    const channelName = `game-updates-${playerCode}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Start subscription for game updates with simplified subscription handling
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'number-called' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received number-called update for session ${sessionId}`);
          setGameState(prev => ({
            ...prev,
            calledNumbers: payload.payload.calledNumbers || [],
            lastCalledNumber: payload.payload.lastCalledNumber
          }));
          setIsConnected(true);
          setConnectionState('connected');
        }
      })
      .on('broadcast', { event: 'pattern-change' }, payload => {
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prev => ({
            ...prev,
            currentWinPattern: payload.payload.pattern
          }));
        }
      })
      .on('broadcast', { event: 'claim-result' }, payload => {
        if (payload.payload?.playerId === playerCode || payload.payload?.playerId === playerId) {
          const result = payload.payload.result;
          
          if (result === 'valid') {
            setClaimStatus('valid');
          } else if (result === 'rejected' || result === 'invalid') {
            setClaimStatus('invalid');
          }
          
          setIsSubmittingClaim(false);
        }
      })
      .subscribe(status => {
        logWithTimestamp(`Channel ${channelName} subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setIsLoading(false);
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error connecting to game updates');
          setConnectionState('error');
          setIsConnected(false);
          setIsLoading(false);
        } else if (status === 'TIMED_OUT') {
          setError('Connection timed out');
          setConnectionState('error');
          setIsConnected(false);
          setIsLoading(false);
        }
      });

    // Store the channel for cleanup
    channelRef.current = channel;

    // Get player info
    const getPlayerInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, nickname')
          .eq('player_code', playerCode)
          .single();

        if (error) throw error;

        if (data) {
          setPlayerId(data.id);
          setPlayerName(data.nickname || playerCode);
        }
      } catch (err) {
        console.error('Error fetching player info:', err);
      }
    };

    // Get session info
    const getSessionInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (error) throw error;

        if (data) {
          setCurrentSession(data);
        }
      } catch (err) {
        console.error('Error fetching session info:', err);
      }
    };

    // Initialize data
    Promise.all([getPlayerInfo(), getSessionInfo()]).then(() => {
      logWithTimestamp(`Initial data loaded for player ${playerCode}`);
    });

    // Send a simple heartbeat every 30 seconds to keep the connection alive
    const heartbeatInterval = setInterval(() => {
      if (channel && connectionState === 'connected') {
        channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { playerCode, timestamp: Date.now() }
        }).catch(err => {
          console.error('Heartbeat error:', err);
          reconnect();
        });
      }
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      
      if (channelRef.current) {
        try {
          logWithTimestamp(`Cleaning up channel for player ${playerCode}`);
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error("Error removing channel during cleanup:", err);
        }
      }
    };
  }, [playerCode, sessionId, reconnect, playerId]);

  // Function to submit a bingo claim
  const submitBingoClaim = useCallback((ticketData: any) => {
    if (!playerCode || !sessionId || !playerName) {
      console.error('Missing player info for claim');
      return false;
    }

    try {
      logWithTimestamp(`Player ${playerCode} submitting bingo claim`);
      
      setIsSubmittingClaim(true);
      setClaimStatus('pending');

      // Broadcast the claim to the caller
      const broadcastChannel = supabase.channel('bingo-broadcast');
      
      // Add a timestamp to the payload for uniqueness
      const timestamp = new Date().toISOString();
      const uniqueId = `claim-${playerCode}-${timestamp}`;
      
      broadcastChannel.send({
        type: 'broadcast',
        event: 'bingo-claim',
        payload: {
          id: uniqueId,
          sessionId,
          playerId: playerId || playerCode,
          playerName: playerName || playerCode,
          ticketData,
          timestamp
        }
      }).then(() => {
        logWithTimestamp('Claim broadcast sent successfully');
        
        // Set a timeout to reset claim status if no response
        setTimeout(() => {
          if (claimStatus === 'pending') {
            setClaimStatus('none');
            setIsSubmittingClaim(false);
          }
        }, 10000);
        
      }).catch(error => {
        console.error('Error broadcasting claim:', error);
        setClaimStatus('none');
        setIsSubmittingClaim(false);
      });

      return true;
    } catch (error) {
      console.error('Error submitting claim:', error);
      setClaimStatus('none');
      setIsSubmittingClaim(false);
      return false;
    }
  }, [playerCode, sessionId, playerId, playerName, claimStatus]);

  return {
    isLoading,
    isConnected,
    connectionState,
    error,
    playerId,
    playerName,
    gameState,
    currentSession,
    submitBingoClaim,
    isSubmittingClaim,
    claimStatus,
    resetClaimStatus,
    reconnect
  };
}
