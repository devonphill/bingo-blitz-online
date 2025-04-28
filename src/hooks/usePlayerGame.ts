import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameType, WinPattern } from '@/types';

export function usePlayerGame(playerCode: string | null) {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [currentGameState, setCurrentGameState] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState<string>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [calledItems, setCalledItems] = useState<number[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [winPrizes, setWinPrizes] = useState<{[key: string]: string}>({});
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  const [gameType, setGameType] = useState<GameType>('mainstage');
  const { toast } = useToast();
  
  // Function to reset claim status
  const resetClaimStatus = useCallback(() => {
    console.log('Resetting claim status');
    setClaimStatus(null);
    setIsSubmittingClaim(false);
  }, []);
  
  // Function to handle bingo claims
  const handleClaimBingo = useCallback(async (ticketData: any) => {
    if (!currentSession || !playerId || !playerName || isSubmittingClaim) {
      console.error("Cannot claim: missing required data", { 
        hasSession: !!currentSession, 
        hasPlayerId: !!playerId, 
        hasPlayerName: !!playerName,
        isSubmittingClaim
      });
      return false;
    }
    
    console.log('Claiming bingo with data:', { 
      sessionId: currentSession.id,
      gameNumber: currentGameState?.gameNumber || 1,
      ticket: ticketData 
    });
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // First log the claim to the database
      const { error: logError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: currentSession.id,
          game_number: currentGameState?.gameNumber || 1,
          player_id: playerId,
          player_name: playerName,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          win_pattern: activeWinPatterns[0] || 'fullHouse',
          game_type: gameType,
          called_numbers: calledItems,
          last_called_number: lastCalledItem,
          total_calls: calledItems.length
        });
      
      if (logError) {
        console.error("Failed to log claim:", logError);
        toast({
          title: "Claim Failed",
          description: "There was a problem submitting your claim.",
          variant: "destructive"
        });
        setIsSubmittingClaim(false);
        setClaimStatus(null);
        return false;
      }
      
      // Send real-time notification to the caller
      await supabase.channel('caller-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claimed',
          payload: {
            sessionId: currentSession.id,
            gameNumber: currentGameState?.gameNumber || 1,
            playerCode,
            playerName,
            ticket: ticketData,
            calledNumbers: calledItems,
            lastCalledNumber: lastCalledItem,
            claimedAt: new Date().toISOString()
          }
        });
      
      // Toast notification for the user
      toast({
        title: "Claim Submitted",
        description: "Your bingo claim has been submitted. Please wait for verification.",
      });
      
      return true;
    } catch (error) {
      console.error("Error submitting claim:", error);
      toast({
        title: "Claim Error", 
        description: "There was a problem submitting your claim.", 
        variant: "destructive"
      });
      setIsSubmittingClaim(false);
      setClaimStatus(null);
      return false;
    }
    
    // We don't reset isSubmittingClaim or claimStatus here because
    // they'll be updated by the real-time notifications from the dealer
  }, [currentSession, currentGameState, playerId, playerName, playerCode, calledItems, lastCalledItem, activeWinPatterns, gameType, toast, isSubmittingClaim]);
  
  // Add real-time listener for claim results
  useEffect(() => {
    if (!playerCode || !currentSession?.id) return;
    
    console.log("Setting up claim result listener");
    
    const claimChannel = supabase
      .channel('claim-results')
      .on('broadcast', { event: 'claim-result' }, (payload) => {
        console.log("Received claim result:", payload);
        
        if (payload.payload?.playerId === playerCode) {
          const result = payload.payload.result;
          
          if (result === 'valid') {
            setClaimStatus('validated');
            toast({
              title: "Bingo Verified!",
              description: "Your bingo claim has been verified.",
            });
          } else if (result === 'rejected') {
            setClaimStatus('rejected');
            toast({
              title: "Claim Rejected",
              description: "Your bingo claim was not valid.",
              variant: "destructive"
            });
          }
          
          setIsSubmittingClaim(false);
        }
      })
      .subscribe();
    
    return () => {
      console.log("Cleaning up claim result listener");
      supabase.removeChannel(claimChannel);
    };
  }, [playerCode, currentSession, toast]);
  
  useEffect(() => {
    if (!playerCode) {
      console.error("Player code is missing.");
      setErrorMessage("Player code is required. Please join the game again.");
      setIsLoading(false);
      setLoadingStep('error');
      return;
    }
    
    const loadPlayerData = async () => {
      setIsLoading(true);
      setLoadingStep('fetching-player');
      
      try {
        // Fetch player profile
        const { data: playerData, error: playerError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('access_code', playerCode)
          .single();
        
        if (playerError) {
          console.error("Error fetching player:", playerError);
          setErrorMessage("Failed to load player data. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        if (!playerData) {
          console.error("Player not found with code:", playerCode);
          setErrorMessage("Invalid player code. Please check your code and try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        setPlayerName(playerData.full_name);
        setPlayerId(playerData.id);
        
        // Fetch current session
        setLoadingStep('fetching-session');
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('status', 'active')
          .single();
        
        if (sessionError) {
          console.error("Error fetching session:", sessionError);
          setErrorMessage("Failed to load session data. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        if (!sessionData) {
          console.log("No active session found.");
          setErrorMessage("No active game session found. Please wait for the game to start.");
          setIsLoading(false);
          setLoadingStep('waiting-for-session');
          return;
        }
        
        setCurrentSession(sessionData);
        setGameType(sessionData.game_type || 'mainstage');
        
        // Fetch current game state
        setLoadingStep('fetching-game-state');
        const { data: gameStateData, error: gameStateError } = await supabase
          .from('game_states')
          .select('*')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (gameStateError) {
          console.error("Error fetching game state:", gameStateError);
          setErrorMessage("Failed to load game state. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        if (!gameStateData) {
          console.log("No game state found for session:", sessionData.id);
          setErrorMessage("No active game found. Please wait for the game to start.");
          setIsLoading(false);
          setLoadingStep('waiting-for-game');
          return;
        }
        
        setCurrentGameState(gameStateData);
        
        // Fetch called items
        setLoadingStep('fetching-called-numbers');
        const { data: calledData, error: calledError } = await supabase
          .from('called_numbers')
          .select('number')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true });
        
        if (calledError) {
          console.error("Error fetching called numbers:", calledError);
          setErrorMessage("Failed to load called numbers. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        const calledNumbers = calledData.map(item => item.number);
        setCalledItems(calledNumbers);
        setLastCalledItem(calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null);
        
        // Fetch win prizes
        setLoadingStep('fetching-win-prizes');
        const { data: prizesData, error: prizesError } = await supabase
          .from('win_patterns')
          .select('id, prize')
          .eq('session_id', sessionData.id);
        
        if (prizesError) {
          console.error("Error fetching win prizes:", prizesError);
          setErrorMessage("Failed to load win prizes. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        const prizes: {[key: string]: string} = {};
        prizesData.forEach(item => {
          prizes[item.id] = item.prize;
        });
        setWinPrizes(prizes);
        
        // Fetch active win patterns
        setLoadingStep('fetching-active-patterns');
        const { data: patternsData, error: patternsError } = await supabase
          .from('session_win_patterns')
          .select('win_pattern_id')
          .eq('session_id', sessionData.id);
        
        if (patternsError) {
          console.error("Error fetching active win patterns:", patternsError);
          setErrorMessage("Failed to load active win patterns. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        const patterns = patternsData.map(item => item.win_pattern_id);
        setActiveWinPatterns(patterns);
        
        setIsLoading(false);
        setLoadingStep('completed');
      } catch (error) {
        console.error("Unexpected error:", error);
        setErrorMessage("An unexpected error occurred. Please try again.");
        setIsLoading(false);
        setLoadingStep('error');
      }
    };
    
    loadPlayerData();
  }, [playerCode, toast]);
  
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
