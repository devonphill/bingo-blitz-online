
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { toast } from '@/hooks/use-toast';
import { connectionManager } from '@/utils/connectionManager';

// Define the connection state type
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type ClaimStatus = 'none' | 'pending' | 'valid' | 'invalid';

export function useBingoSync(playerCode: string | null, sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [gameState, setGameState] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('none');

  // Track connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  
  // Function to reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);
  
  // Set up the connection to the session with improved stability
  useEffect(() => {
    // Skip setup if invalid parameters
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }

    // Clear error state and set connecting state
    setError('');
    setIsLoading(true);
    setIsConnected(false);
    
    logWithTimestamp(`Setting up connection for player ${playerCode} to session ${sessionId}`);
    
    // Use the connection manager instead of creating our own channels
    connectionManager.initialize(sessionId)
      .onNumberCalled((lastCalledNumber, calledNumbers) => {
        // Update game state with called numbers
        setGameState(prev => ({
          ...prev,
          calledNumbers: calledNumbers || [],
          lastCalledNumber
        }));
        
        // Update connection status
        setIsConnected(true);
        setConnectionState('connected');
        setIsLoading(false);
      })
      .onSessionProgressUpdate((progress) => {
        // Update game state with session progress
        if (progress) {
          setGameState(prev => ({
            ...prev,
            currentWinPattern: progress.current_win_pattern,
            currentPrize: progress.current_prize
          }));
          
          if (progress.called_numbers && progress.called_numbers.length > 0) {
            setGameState(prev => ({
              ...prev,
              calledNumbers: progress.called_numbers,
              lastCalledNumber: progress.called_numbers[progress.called_numbers.length - 1]
            }));
          }
          
          setIsConnected(true);
          setConnectionState('connected');
          setIsLoading(false);
        }
      });
      
    // Set up a listener for claim results
    const claimsChannel = supabase.channel(`claims-${sessionId}-${playerCode}`);
    claimsChannel
      .on('broadcast', { event: 'claim-result' }, payload => {
        // Process claim results matching our player
        if ((payload.payload?.playerId === playerCode || payload.payload?.playerId === playerId) && 
            payload.payload?.sessionId === sessionId) {
          logWithTimestamp(`Received claim result for player ${playerCode}: ${payload.payload.result}`);
          
          const result = payload.payload.result;
          
          if (result === 'valid') {
            setClaimStatus('valid');
            toast({
              title: "Bingo Verified!",
              description: "Your bingo claim has been verified!",
              variant: "default"
            });
          } else if (result === 'rejected' || result === 'invalid') {
            setClaimStatus('invalid');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not verified.",
              variant: "destructive"
            });
          }
          
          setIsSubmittingClaim(false);
        }
      })
      .subscribe();

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
      setIsLoading(false);
    });

    // Cleanup on unmount
    return () => {
      logWithTimestamp(`Cleaning up channel for player ${playerCode}`);
      
      // Remove the claims channel
      supabase.removeChannel(claimsChannel);
    };
  }, [playerCode, sessionId, playerId]);

  // Function to submit a bingo claim with improved error handling
  const submitBingoClaim = useCallback(async (ticketData: any) => {
    if (!playerCode || !sessionId || !playerName) {
      console.error('Missing player info for claim');
      return false;
    }

    try {
      logWithTimestamp(`Player ${playerCode} submitting bingo claim`);
      
      setIsSubmittingClaim(true);
      setClaimStatus('pending');

      // Add a timestamp to the payload for uniqueness
      const timestamp = new Date().toISOString();
      const uniqueId = `claim-${playerCode}-${timestamp}`;
      
      // Prepare the claim data
      const claimData = {
        id: uniqueId,
        sessionId,
        playerId: playerId || playerCode,
        playerName: playerName || playerCode,
        ticketData,
        timestamp
      };
      
      logWithTimestamp(`Broadcasting bingo claim: ${JSON.stringify(claimData)}`);
      
      try {
        // First record the claim in the database for persistence
        const { error: dbError } = await supabase
          .from('universal_game_logs')
          .insert({
            session_id: sessionId,
            player_id: playerId || playerCode,
            player_name: playerName || playerCode,
            ticket_serial: ticketData?.serial,
            ticket_perm: ticketData?.perm,
            ticket_position: ticketData?.position,
            ticket_layout_mask: ticketData?.layoutMask,
            ticket_numbers: ticketData?.numbers,
            claimed_at: timestamp,
            game_number: currentSession?.current_game || 1,
            game_type: currentSession?.game_type || 'mainstage',
            called_numbers: gameState?.calledNumbers || [],
            last_called_number: gameState?.lastCalledNumber,
            total_calls: gameState?.calledNumbers?.length || 0,
            win_pattern: gameState?.currentWinPattern || 'fullhouse'
          });
          
        if (dbError) {
          console.error("Error recording claim in database:", dbError);
          // Continue anyway to try the broadcast
        }
        
        // Use a temporary channel for the broadcast
        const channel = supabase.channel(`bingo-claim-${sessionId}`);
        await channel.subscribe();
        
        try {
          // Send the claim broadcast
          await channel.send({
            type: 'broadcast',
            event: 'bingo-claim',
            payload: claimData
          });
          
          logWithTimestamp('Claim broadcast sent successfully');
          
          // Clean up the temporary channel
          supabase.removeChannel(channel);
          
          toast({
            title: "Bingo Claim Submitted",
            description: "Your claim has been submitted and is pending verification.",
            duration: 5000
          });
          
          // Set a timeout to reset claim status if no response
          setTimeout(() => {
            if (claimStatus === 'pending') {
              setClaimStatus('none');
              setIsSubmittingClaim(false);
              
              toast({
                title: "Claim Verification Timeout",
                description: "No response received for your claim. Please try again.",
                variant: "destructive",
                duration: 5000
              });
            }
          }, 10000);
          
          return true;
        } catch (error) {
          console.error('Error sending claim broadcast:', error);
          throw error;
        }
      } catch (error) {
        console.error('Error broadcasting claim:', error);
        setClaimStatus('none');
        setIsSubmittingClaim(false);
        
        toast({
          title: "Claim Error",
          description: "Failed to submit your bingo claim. Please try again.",
          variant: "destructive"
        });
        
        return false;
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      setClaimStatus('none');
      setIsSubmittingClaim(false);
      return false;
    }
  }, [playerCode, sessionId, playerId, playerName, currentSession, gameState, claimStatus]);

  // Provide a way to manually reconnect
  const reconnect = useCallback(() => {
    if (!sessionId) return;
    
    setConnectionState('connecting');
    connectionManager.reconnect();
    
    // Refresh data manually from Supabase
    supabase
      .from('sessions_progress')
      .select('*')
      .eq('session_id', sessionId)
      .single()
      .then(({ data }) => {
        if (data) {
          // Update game state with the fetched data
          setGameState(prev => ({
            ...prev,
            currentWinPattern: data.current_win_pattern,
            currentPrize: data.current_prize
          }));
          
          if (data.called_numbers && data.called_numbers.length > 0) {
            setGameState(prev => ({
              ...prev,
              calledNumbers: data.called_numbers,
              lastCalledNumber: data.called_numbers[data.called_numbers.length - 1]
            }));
          }
          
          setConnectionState('connected');
          setIsConnected(true);
        }
      })
      .catch(error => {
        console.error("Error refreshing data:", error);
        setConnectionState('error');
      });
  }, [sessionId]);

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
