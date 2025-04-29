
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameType } from '@/types';

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
  const handleClaimBingo = useCallback(async () => {
    if (!currentSession || !playerId || !playerName || isSubmittingClaim) {
      console.error("Cannot claim: missing required data", { 
        hasSession: !!currentSession, 
        hasPlayerId: !!playerId, 
        hasPlayerName: !!playerName,
        isSubmittingClaim
      });
      return false;
    }
    
    console.log('Claiming bingo with session data:', { 
      sessionId: currentSession.id,
      gameNumber: currentGameState?.gameNumber || 1,
      playerCode,
      playerName
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
          ticket_serial: "Auto-claim",
          ticket_perm: 0,
          ticket_position: 0,
          ticket_layout_mask: 0,
          ticket_numbers: [],
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
  
  // Load player data and session info
  useEffect(() => {
    // Validate playerCode - make sure to clear error message if playerCode is valid
    if (playerCode && playerCode.trim() !== '') {
      // Reset error message since we have a valid code
      setErrorMessage('');
    } else {
      console.error("Player code is missing or empty.");
      setErrorMessage("Player code is required. Please join the game again.");
      setIsLoading(false);
      setLoadingStep('error');
      return;
    }
    
    const loadPlayerData = async () => {
      setIsLoading(true);
      setLoadingStep('fetching-player');
      
      try {
        console.log("Fetching player data with code:", playerCode);
        
        // Fetch player profile
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, session_id')  // Added session_id to the query
          .eq('player_code', playerCode)
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
        
        // Use nickname instead of full_name
        setPlayerName(playerData.nickname);
        setPlayerId(playerData.id);
        console.log("Player found:", playerData);
        
        // Get the specific session associated with this player
        if (!playerData.session_id) {
          console.error("Player has no assigned session.");
          setErrorMessage("You are not assigned to any game session. Please contact the game organizer.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        // Fetch the specific session this player belongs to
        setLoadingStep('fetching-session');
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', playerData.session_id)  // Use player's session_id instead of filtering by status
          .single();
        
        if (sessionError) {
          console.error("Error fetching session:", sessionError);
          setErrorMessage("Failed to load session data. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        if (!sessionData) {
          console.log("Session not found for this player.");
          setErrorMessage("The game session you were assigned to no longer exists. Please contact the game organizer.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        console.log("Player session found:", sessionData);
        setCurrentSession(sessionData);
        
        // Use setGameType with a type assertion to ensure type safety
        const sessionGameType = sessionData.game_type || 'mainstage';
        setGameType(sessionGameType as GameType);
        
        // Fetch current game state - This is a placeholder, adjust based on your actual schema
        setLoadingStep('fetching-game-state');
        const gameStateData = {
          gameNumber: sessionData.current_game || 1
        };
        
        setCurrentGameState(gameStateData);
        
        // Fetch called items
        setLoadingStep('fetching-called-numbers');
        
        // Fetch from sessions_progress for called numbers
        const { data: progressData, error: progressError } = await supabase
          .from('sessions_progress')
          .select('called_numbers, current_win_pattern')
          .eq('session_id', sessionData.id)
          .single();
        
        if (progressError) {
          console.error("Error fetching called numbers:", progressError);
          setErrorMessage("Failed to load called numbers. Please try again.");
          setIsLoading(false);
          setLoadingStep('error');
          return;
        }
        
        if (progressData) {
          const calledNumbers = progressData.called_numbers || [];
          setCalledItems(calledNumbers);
          setLastCalledItem(calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null);
          
          if (progressData.current_win_pattern) {
            setActiveWinPatterns([progressData.current_win_pattern]);
          }
        }
        
        // Fetch win prizes - adjust as needed based on your schema
        setWinPrizes({});
        
        setIsLoading(false);
        setLoadingStep('completed');
        console.log("Player game data loading completed successfully");
      } catch (error) {
        console.error("Unexpected error:", error);
        setErrorMessage("An unexpected error occurred. Please try again.");
        setIsLoading(false);
        setLoadingStep('error');
      }
    };
    
    loadPlayerData();
  }, [playerCode]);
  
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
