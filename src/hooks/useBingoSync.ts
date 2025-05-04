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
  
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Set up the connection to the session
  useEffect(() => {
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }

    // Try to connect to the session
    setIsLoading(true);
    setIsConnected(false);
    setError('');

    logWithTimestamp(`Setting up connection for player ${playerCode} to session ${sessionId}`);
    
    // Start subscription for game updates
    const channel = supabase
      .channel('game-updates')
      .on('broadcast', { event: 'number-called' }, payload => {
        console.log('Received number-called update:', payload);
        if (payload.payload?.sessionId === sessionId) {
          setGameState(prev => ({
            ...prev,
            calledNumbers: payload.payload.calledNumbers || [],
            lastCalledNumber: payload.payload.lastCalledNumber
          }));
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
          setIsLoading(false);
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error connecting to game updates');
          setIsConnected(false);
          setIsLoading(false);
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
    Promise.all([getPlayerInfo(), getSessionInfo()]);

    // Store the channel for cleanup
    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up useBingoSync');
      supabase.removeChannel(channel);
      if (claimChannelRef.current) {
        supabase.removeChannel(claimChannelRef.current);
      }
    };
  }, [playerCode, sessionId]);

  // Function to submit a bingo claim
  // This no longer writes to the database directly but broadcasts to the caller
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
      broadcastChannel.send({
        type: 'broadcast',
        event: 'bingo-claim',
        payload: {
          sessionId,
          playerId: playerId || playerCode,
          playerName: playerName || playerCode,
          ticketData,
          timestamp: new Date().toISOString()
        }
      }).then(() => {
        logWithTimestamp('Claim broadcast sent successfully');
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
  }, [playerCode, sessionId, playerId, playerName]);

  return {
    isLoading,
    isConnected,
    error,
    playerId,
    playerName,
    gameState,
    currentSession,
    submitBingoClaim,
    isSubmittingClaim,
    claimStatus,
    resetClaimStatus
  };
}
