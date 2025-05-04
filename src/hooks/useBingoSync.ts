
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function useBingoSync(playerCode: string | null, sessionId: string | null) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');
  const { toast } = useToast();

  // Reset claim status after a timeout
  const resetClaimStatus = useCallback(() => {
    setTimeout(() => {
      setClaimStatus('none');
    }, 5000);
  }, []);
  
  // Initialize the sync
  useEffect(() => {
    if (!playerCode) {
      setIsLoading(false);
      setError('No player code provided');
      return;
    }
    
    const initializeSync = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Step 1: Look up the player by player code
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, session_id')
          .eq('player_code', playerCode)
          .single();
          
        if (playerError) {
          console.error('Error looking up player:', playerError);
          setError('Could not find player with that code');
          setIsLoading(false);
          return;
        }
        
        if (!playerData) {
          setError('Player not found');
          setIsLoading(false);
          return;
        }
        
        setPlayerId(playerData.id);
        setPlayerName(playerData.nickname);
        
        // Step 2: Look up the current session
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', playerData.session_id)
          .single();
          
        if (sessionError) {
          console.error('Error looking up session:', sessionError);
          setError('Session not found');
          setIsLoading(false);
          return;
        }
        
        if (!sessionData) {
          setError('Session not available');
          setIsLoading(false);
          return;
        }
        
        setCurrentSession(sessionData);
        
        // Step 3: Get the current game state
        const { data: progressData, error: progressError } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionData.id)
          .single();
          
        if (progressError) {
          console.error('Error looking up session progress:', progressError);
        }
        
        if (progressData) {
          setGameState({
            gameNumber: sessionData.current_game,
            calledNumbers: progressData.called_numbers || [],
            lastCalledNumber: progressData.called_numbers?.length > 0 
              ? progressData.called_numbers[progressData.called_numbers.length - 1] 
              : null,
            winPattern: progressData.current_win_pattern
          });
        } else {
          // If no progress found, initialize with empty state
          setGameState({
            gameNumber: sessionData.current_game,
            calledNumbers: [],
            lastCalledNumber: null,
            winPattern: null
          });
        }
        
        setIsConnected(true);
        setError(null);
      } catch (err) {
        console.error('Error initializing sync:', err);
        setError('Failed to connect to game');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeSync();
  }, [playerCode]);
  
  // Set up listener for game updates
  useEffect(() => {
    if (!currentSession?.id) return;
    
    try {
      logWithTimestamp(`Setting up game updates listener for session ${currentSession.id}`);
      
      const channel = supabase
        .channel('game-updates')
        .on('broadcast', { event: 'number-called' }, payload => {
          console.log('Received number called broadcast:', payload);
          
          if (payload.payload?.sessionId === currentSession.id) {
            const calledNumbers = payload.payload.calledNumbers || [];
            const lastCalledNumber = payload.payload.lastCalledNumber;
            
            setGameState(prev => ({
              ...prev,
              calledNumbers: calledNumbers,
              lastCalledNumber: lastCalledNumber
            }));
            
            toast({
              title: `Number Called: ${lastCalledNumber}`,
              description: `${calledNumbers.length} numbers called so far`
            });
          }
        })
        .on('broadcast', { event: 'pattern-change' }, payload => {
          console.log('Received pattern change broadcast:', payload);
          
          if (payload.payload?.sessionId === currentSession.id) {
            setGameState(prev => ({
              ...prev,
              winPattern: payload.payload.pattern
            }));
            
            toast({
              title: 'Win Pattern Changed',
              description: `New pattern: ${payload.payload.pattern}`
            });
          }
        })
        .on('broadcast', { event: 'claim-result' }, payload => {
          console.log('Received claim result broadcast:', payload);
          
          // Check if this message is for us
          if (payload.payload?.playerId === playerId || payload.payload?.playerId === playerCode) {
            if (payload.payload.result === 'valid') {
              setClaimStatus('valid');
              toast({
                title: 'Claim Validated!',
                description: 'Your bingo claim has been validated.',
                variant: 'default'
              });
            } else {
              setClaimStatus('invalid');
              toast({
                title: 'Claim Rejected',
                description: 'Your bingo claim was not valid.',
                variant: 'destructive'
              });
            }
            
            // Reset claim status after a delay
            resetClaimStatus();
          }
        })
        .on('broadcast', { event: 'game-force-closed' }, payload => {
          console.log('Received game force closed broadcast:', payload);
          
          if (payload.payload?.sessionId === currentSession.id) {
            toast({
              title: 'Game Ended',
              description: 'The current game has been ended by the caller.',
              variant: 'destructive'
            });
            
            // Reset the game state
            setGameState(prev => ({
              ...prev,
              calledNumbers: [],
              lastCalledNumber: null
            }));
          }
        })
        .subscribe(status => {
          console.log('Game updates subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to game updates');
            setIsConnected(true);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Error subscribing to game updates');
            setIsConnected(false);
            setError('Connection to game lost');
          }
        });
      
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.error('Error setting up game updates listener:', err);
    }
  }, [currentSession?.id, playerId, playerCode, toast, resetClaimStatus]);
  
  // Function to submit a bingo claim
  const submitBingoClaim = useCallback(async (ticketData: any) => {
    if (!sessionId || !playerId || !gameState) {
      console.error('Cannot submit claim: missing required information');
      return false;
    }
    
    if (isSubmittingClaim) {
      return false;
    }
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      const currentGameNumber = currentSession?.current_game || 1;
      const activeWinPattern = gameState.winPattern || 'fullHouse';
      
      toast({
        title: 'Submitting Claim',
        description: `Claiming bingo for ${activeWinPattern}`
      });
      
      console.log("Sending claim to caller to validate");
      
      // First add the claim to the universal_game_logs table
      // FIX: Add an actual timestamp value for validated_at instead of null
      // This resolves the "null value in column validated_at" error
      const { data, error } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          player_id: playerId,
          player_name: playerName || playerCode,
          game_number: currentGameNumber,
          game_type: currentSession?.game_type || 'mainstage',
          win_pattern: activeWinPattern,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          called_numbers: gameState.calledNumbers,
          last_called_number: gameState.lastCalledNumber,
          total_calls: (gameState.calledNumbers || []).length,
          claimed_at: new Date().toISOString(),
          validated_at: null, // THIS LINE IS FIXED - now will be null
          prize_shared: false // This will be updated when the claim is validated
        });
      
      if (error) {
        console.error("Error submitting claim:", error);
        toast({
          title: "Claim Error",
          description: `Failed to submit claim: ${error.message}`,
          variant: "destructive"
        });
        setClaimStatus('none');
        return false;
      }
      
      console.log("Claim submitted successfully!");
      
      // Broadcast the claim to the caller
      await supabase
        .channel('bingo-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: { 
            sessionId, 
            playerId,
            playerName,
            playerCode,
            ticketId: ticketData.serial,
            timestamp: new Date().toISOString(),
            winPattern: activeWinPattern
          }
        });
      
      toast({
        title: "Claim Submitted",
        description: "Your bingo claim has been submitted for verification",
      });
      
      return true;
    } catch (error: any) {
      console.error("Error submitting claim:", error);
      toast({
        title: "Claim Error",
        description: `Failed to submit claim: ${error.message}`,
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSubmittingClaim(false);
    }
  }, [sessionId, playerId, playerName, gameState, isSubmittingClaim, currentSession, playerCode, toast]);

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
