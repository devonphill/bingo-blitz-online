import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

export function usePlayerGame(playerCode: string | null) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [currentGameState, setCurrentGameState] = useState<any>(null);
  const [calledItems, setCalledItems] = useState<number[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [winPrizes, setWinPrizes] = useState<Record<string, string>>({});
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('initializing');
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');
  const [gameType, setGameType] = useState<string>('mainstage');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const { toast } = useToast();

  // Step 1: Fetch player data and validate player code
  useEffect(() => {
    const getPlayerData = async () => {
      if (!playerCode) {
        setErrorMessage('Player code is required');
        setIsLoading(false);
        return;
      }

      setLoadingStep('loading player data');
      
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('player_code', playerCode)
          .single();

        if (error) {
          console.error('Error fetching player data:', error);
          setErrorMessage('Invalid player code or player not found');
          setIsLoading(false);
          return;
        }

        setPlayerId(data.id);
        setPlayerName(data.nickname);
        
        // Set auto marking state from local storage if available
        const storedAutoMarkingPref = localStorage.getItem('autoMarking');
        if (storedAutoMarkingPref !== null) {
          setAutoMarking(storedAutoMarkingPref === 'true');
        }
        
        getSessionData(data.session_id);
      } catch (error) {
        console.error('Exception fetching player data:', error);
        setErrorMessage('Error fetching player data');
        setIsLoading(false);
      }
    };

    getPlayerData();
  }, [playerCode]);

  // Step 2: Fetch session data based on player's session ID
  const getSessionData = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setErrorMessage('Session ID is required');
      setIsLoading(false);
      return;
    }

    setLoadingStep('loading session data');
    
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error fetching session data:', error);
        setErrorMessage('Invalid session or session not found');
        setIsLoading(false);
        return;
      }

      setCurrentSession(data);
      setGameType(data.game_type);
      
      // Get session progress
      getSessionProgress(sessionId, data.current_game);
      
    } catch (error) {
      console.error('Exception fetching session data:', error);
      setErrorMessage('Error fetching session data');
      setIsLoading(false);
    }
  }, []);

  // Step 3: Fetch session progress
  const getSessionProgress = useCallback(async (sessionId: string, gameNumber: number) => {
    setLoadingStep('loading game progress');
    
    try {
      // Get session progress
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (progressError) {
        console.error('Error fetching session progress:', progressError);
        setErrorMessage('Error fetching game progress');
        setIsLoading(false);
        return;
      }

      if (progressData) {
        // Set called numbers
        if (progressData.called_numbers && progressData.called_numbers.length > 0) {
          setCalledItems(progressData.called_numbers);
          setLastCalledItem(progressData.called_numbers[progressData.called_numbers.length - 1]);
        }
        
        // Set active win pattern
        if (progressData.current_win_pattern) {
          setActiveWinPatterns([progressData.current_win_pattern]);
        }
        
        // Set win prize
        if (progressData.current_win_pattern && progressData.current_prize) {
          setWinPrizes({
            [progressData.current_win_pattern]: progressData.current_prize
          });
        }
      }

      // Game info is now ready
      setLoadingStep('completed');
      setIsLoading(false);
      
      // Listen for game updates
      setupGameListener(sessionId);
      
    } catch (error) {
      console.error('Exception in getSessionProgress:', error);
      setErrorMessage('Error fetching game progress');
      setIsLoading(false);
    }
  }, []);
  
  // Set up listener for claim results
  useEffect(() => {
    if (!playerCode) return;
    
    const channel = supabase
      .channel('player-claim-results')
      .on('broadcast', { event: 'claim-result' }, payload => {
        logWithTimestamp('Received claim result broadcast:', payload);
        
        // Check if this claim result is for this player
        if (payload.payload && payload.payload.playerId === playerCode) {
          const result = payload.payload.result;
          
          setClaimStatus(result === 'valid' ? 'valid' : 'invalid');
          toast({
            title: result === 'valid' ? "Bingo Confirmed!" : "Invalid Claim",
            description: result === 'valid' 
              ? "Your bingo claim has been verified and accepted!" 
              : "Your bingo claim was not verified. Please check your card.",
            variant: result === 'valid' ? "default" : "destructive"
          });
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerCode, toast]);

  // Setup game listener for real-time updates
  const setupGameListener = useCallback((sessionId: string) => {
    // Listen for number calls
    const channel = supabase
      .channel('game-updates-listener')
      .on(
        'broadcast',
        { event: 'number-called' },
        payload => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            console.log('Received number call broadcast:', payload.payload);
            const { lastCalledNumber, calledNumbers } = payload.payload;
            setCalledItems(calledNumbers);
            setLastCalledItem(lastCalledNumber);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'pattern-change' },
        payload => {
          if (payload.payload && payload.payload.sessionId === sessionId) {
            console.log('Received pattern change broadcast:', payload.payload);
            const { pattern } = payload.payload;
            setActiveWinPatterns([pattern]);
            
            toast({
              title: "Win Pattern Changed",
              description: `The win pattern has been updated to ${pattern}`,
              duration: 5000
            });
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
  
  // Handle claim reset
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);
  
  // Handle bingo claim
  const handleClaimBingo = useCallback(async () => {
    if (!currentSession?.id || !playerId || !playerName) {
      console.error("Cannot claim bingo: missing session, player ID, or player name");
      return false;
    }
    
    if (isSubmittingClaim) {
      console.log("Already submitting claim, please wait");
      return false;
    }
    
    logWithTimestamp(`Player ${playerName} (${playerCode}) claiming bingo`);
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // Insert claim record in game logs
      const { error: logError } = await supabase.from('universal_game_logs').insert([{
        session_id: currentSession.id,
        game_number: currentSession.current_game,
        game_type: gameType,
        win_pattern: activeWinPatterns[0] || 'fullHouse',
        player_id: playerCode,
        player_name: playerName,
        claimed_at: new Date().toISOString(),
        validated_at: null // This will be updated when the caller validates
      }]);
      
      if (logError) {
        console.error('Error logging claim:', logError);
        setClaimStatus('none');
        setIsSubmittingClaim(false);
        return false;
      }
      
      // Broadcast the claim for real-time notification
      await supabase
        .channel('bingo-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            sessionId: currentSession.id,
            playerId: playerId,
            playerCode: playerCode,
            playerName: playerName,
            timestamp: new Date().getTime()
          }
        });
      
      logWithTimestamp("Claim broadcast sent");
      
      toast({
        title: "Bingo Claim Submitted",
        description: "Your claim has been sent to the caller for verification",
        duration: 5000
      });
      
      // Keep status as pending until we get a response from caller
      setTimeout(() => {
        if (claimStatus === 'pending') {
          toast({
            title: "Claim Pending",
            description: "Your claim is still being verified by the caller",
            duration: 5000
          });
        }
      }, 10000);
      
      return true;
    } catch (error) {
      console.error('Exception in handleClaimBingo:', error);
      setClaimStatus('none');
      return false;
    } finally {
      setIsSubmittingClaim(false);
    }
  }, [currentSession, playerId, playerName, playerCode, gameType, activeWinPatterns, claimStatus, toast, isSubmittingClaim]);

  return {
    playerName,
    playerId,
    currentSession,
    currentGameState,
    calledItems,
    lastCalledItem,
    activeWinPatterns,
    winPrizes,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    loadingStep,
    resetClaimStatus,
    claimStatus,
    gameType,
    isSubmittingClaim,
    handleClaimBingo
  };
}
