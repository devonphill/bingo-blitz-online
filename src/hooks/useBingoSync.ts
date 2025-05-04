import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

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

  // Keep track of channel subscriptions
  const channelRef = useRef<any>(null);
  const claimChannelRef = useRef<any>(null);
  
  // Track if the connection setup is in progress to prevent multiple connection attempts
  const connectionSetupInProgress = useRef<boolean>(false);
  
  // For reconnection purposes
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');
  const reconnect = useCallback(() => {
    if (connectionSetupInProgress.current) {
      logWithTimestamp(`Connection setup already in progress for player ${playerCode}, ignoring reconnect request`);
      return;
    }
    
    logWithTimestamp(`Manual reconnection requested for player ${playerCode}`);
    setConnectionState('connecting');
    
    // Re-initialize channel subscriptions
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } catch (err) {
        console.error("Error removing channel during reconnect:", err);
      }
    }
    
    // Setup will happen in the useEffect that depends on connectionState
    setTimeout(() => {
      setConnectionState('disconnected');
    }, 100);
  }, [playerCode]);
  
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Set up the connection to the session
  useEffect(() => {
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }

    // Prevent multiple connection setups
    if (connectionSetupInProgress.current) {
      logWithTimestamp(`Connection setup already in progress for player ${playerCode}, skipping duplicate setup`);
      return;
    }
    
    connectionSetupInProgress.current = true;

    // Try to connect to the session
    setIsLoading(true);
    setIsConnected(false);
    setConnectionState('connecting');
    setError('');

    logWithTimestamp(`Setting up connection for player ${playerCode} to session ${sessionId}`);
    
    // Generate a unique channel name for this player and session
    const channelName = `game-updates-${playerCode}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Start subscription for game updates
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'number-called' }, payload => {
        console.log('Received number-called update:', payload);
        if (payload.payload?.sessionId === sessionId) {
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
        console.log('Received pattern-change update:', payload);
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prev => ({
            ...prev,
            currentWinPattern: payload.payload.pattern
          }));
        }
      })
      .on('broadcast', { event: 'claim-result' }, payload => {
        console.log('Received claim-result:', payload);
        if (payload.payload?.playerId === playerCode || payload.payload?.playerId === playerId) {
          const result = payload.payload.result;
          console.log(`Claim result received: ${result}`);
          
          if (result === 'valid') {
            setClaimStatus('valid');
          } else if (result === 'rejected' || result === 'invalid') {
            setClaimStatus('invalid');
          }
          
          setIsSubmittingClaim(false);
        }
      })
      .subscribe(status => {
        console.log('Game updates channel status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionState('connected');
          setIsLoading(false);
          connectionSetupInProgress.current = false;
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error connecting to game updates');
          setConnectionState('error');
          setIsConnected(false);
          setIsLoading(false);
          connectionSetupInProgress.current = false;
        } else if (status === 'TIMED_OUT') {
          setError('Connection timed out');
          setConnectionState('error');
          setIsConnected(false);
          setIsLoading(false);
          connectionSetupInProgress.current = false;
          
          // Try to reconnect automatically after timeout
          setTimeout(() => {
            if (connectionState !== 'connected') {
              reconnect();
            }
          }, 3000);
        } else if (status === 'CLOSED') {
          logWithTimestamp(`Channel ${channelName} was closed`);
          connectionSetupInProgress.current = false;
        }
      });

    // Set up channel for claim results
    const claimChannel = supabase.channel('claim-results');
    claimChannelRef.current = claimChannel;

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
    }, (err) => {
      console.error('Error loading initial data:', err);
    });

    // Store the channel for cleanup
    channelRef.current = channel;

    // Set up a heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (channel && connectionState === 'connected') {
        try {
          // Ping to keep the connection alive
          channel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: {
              playerCode,
              timestamp: Date.now()
            }
          }).then(() => {
            // Heartbeat sent successfully
          }, (err) => {
            console.error('Heartbeat error:', err);
            if (connectionState !== 'connecting') {
              setConnectionState('disconnected');
              reconnect();
            }
          });
        } catch (err) {
          console.error('Error sending heartbeat:', err);
        }
      }
    }, 30000); // Every 30 seconds

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up useBingoSync');
      clearInterval(heartbeatInterval);
      
      if (channelRef.current) {
        try {
          logWithTimestamp(`Removing channel for player ${playerCode}`);
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.error("Error removing channel during cleanup:", err);
        }
      }
      
      if (claimChannelRef.current) {
        try {
          supabase.removeChannel(claimChannelRef.current);
          claimChannelRef.current = null;
        } catch (err) {
          console.error("Error removing claim channel during cleanup:", err);
        }
      }
      
      connectionSetupInProgress.current = false;
    };
  }, [playerCode, sessionId, connectionState, reconnect, playerId]);

  // Function to submit a bingo claim
  // This no longer writes to the database directly but broadcasts to the caller
  const submitBingoClaim = useCallback((ticketData: any) => {
    if (!playerCode || !sessionId || !playerName) {
      console.error('Missing player info for claim');
      return false;
    }

    try {
      logWithTimestamp(`Player ${playerCode} submitting bingo claim`);
      console.log('Submitting claim with ticket data:', ticketData);
      
      setIsSubmittingClaim(true);
      setClaimStatus('pending');

      // Broadcast the claim to the caller using a unique channel name to avoid conflicts
      const broadcastChannel = supabase.channel('bingo-broadcast');
      
      // Add a timestamp to the payload for uniqueness
      const timestamp = new Date().toISOString();
      const uniqueId = `claim-${playerCode}-${timestamp}`;
      
      // Use Promise pattern instead of chaining with .then() and .catch()
      Promise.resolve(
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
        })
      )
      .then(() => {
        logWithTimestamp('Claim broadcast sent successfully');
        
        // Subscribe to get the result back - this is crucial to hear about validation
        const resultChannel = supabase
          .channel(`claim-result-${uniqueId}`)
          .on('broadcast', { event: 'claim-result' }, payload => {
            console.log('Received direct claim result:', payload);
            if (payload.payload?.playerId === playerCode || payload.payload?.playerId === playerId) {
              const result = payload.payload.result;
              console.log(`Direct claim result received: ${result}`);
              
              if (result === 'valid') {
                setClaimStatus('valid');
              } else if (result === 'rejected' || result === 'invalid') {
                setClaimStatus('invalid');
              }
              
              setIsSubmittingClaim(false);
            }
          })
          .subscribe();
        
        // Clean up this channel after some time
        setTimeout(() => {
          try {
            supabase.removeChannel(resultChannel);
          } catch (err) {
            console.error("Error removing result channel:", err);
          }
        }, 60000); // 1 minute timeout
      }, (error) => { // Using this pattern instead of .catch()
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
  }, [playerCode, sessionId, playerId, playerName]);

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
