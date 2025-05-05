import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBingoSync } from '@/hooks/useBingoSync';
import { useTickets } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';

export function usePlayerGame(playerCode: string | null) {
  // State for player data
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // State for session and game data
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [currentGameState, setCurrentGameState] = useState<any | null>(null);
  
  // State for game mechanics
  const [calledItems, setCalledItems] = useState<number[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [winPrizes, setWinPrizes] = useState<Record<string, string>>({});
  
  // State for UI and user preferences
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('initializing');
  
  // State for bingo claims
  const [claimStatus, setClaimStatus] = useState<'none' | 'pending' | 'valid' | 'invalid'>('none');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState<boolean>(false);
  
  // Game type (default to mainstage/90-ball)
  const [gameType, setGameType] = useState<string>('mainstage');
  
  // Get the network context for connection management
  const network = useNetwork();
  
  // Get toast for notifications
  const { toast } = useToast();
  
  // Track if component is mounted
  const isMounted = useRef(true);
  
  // Generate a unique ID for this hook instance for better debug logging
  const instanceId = useRef(`playerGame-${Math.random().toString(36).substring(2, 9)}`);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Load auto-marking preference from localStorage
  useEffect(() => {
    const savedAutoMarking = localStorage.getItem('autoMarking');
    if (savedAutoMarking !== null) {
      setAutoMarking(savedAutoMarking === 'true');
    }
  }, []);
  
  // Get tickets for this player
  const { tickets } = useTickets(playerCode, currentSession?.id);
  
  // Initialize bingo sync hook for real-time updates AFTER connection is established
  const {
    isLoading: bingoSyncLoading,
    error: bingoSyncError,
    gameState,
    submitBingoClaim: claimBingo
  } = useBingoSync(
    playerCode,
    currentSession?.id
  );
  
  // Update game state from real-time updates
  useEffect(() => {
    if (gameState) {
      // Update called numbers if they've changed
      if (gameState.calledNumbers && gameState.calledNumbers.length > 0) {
        setCalledItems(gameState.calledNumbers);
      }
      
      // Update last called number if it's changed
      if (gameState.lastCalledNumber !== null) {
        setLastCalledItem(gameState.lastCalledNumber);
      }
      
      // Update win pattern if it's changed
      if (gameState.currentWinPattern) {
        setActiveWinPatterns([gameState.currentWinPattern]);
      }
      
      // Update prizes if they've changed
      if (gameState.currentPrize && gameState.currentWinPattern) {
        setWinPrizes(prev => ({
          ...prev,
          [gameState.currentWinPattern]: gameState.currentPrize
        }));
      }
    }
  }, [gameState]);
  
  // Handle connection errors
  useEffect(() => {
    if (bingoSyncError) {
      setErrorMessage(`Connection error: ${bingoSyncError}`);
    }
  }, [bingoSyncError]);
  
  // Load player data
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!playerCode) {
        setErrorMessage('Player code is required');
        setIsLoading(false);
        return;
      }
      
      setLoadingStep('loading_player');
      
      try {
        // Get player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('player_code', playerCode)
          .single();
        
        if (playerError) {
          console.error('Error loading player:', playerError);
          setErrorMessage(`Error loading player: ${playerError.message}`);
          setIsLoading(false);
          return;
        }
        
        if (!playerData) {
          setErrorMessage('Player not found');
          setIsLoading(false);
          return;
        }
        
        // Set player data - use nickname instead of name
        setPlayerName(playerData.nickname || playerData.player_code);
        setPlayerId(playerData.id);
        
        // Load session data
        await loadSessionData(playerData.id);
      } catch (error: any) {
        console.error('Error in loadPlayerData:', error);
        setErrorMessage(`Error loading player data: ${error.message}`);
        setIsLoading(false);
      }
    };
    
    if (playerCode) {
      loadPlayerData();
    } else {
      setIsLoading(false);
    }
  }, [playerCode]);
  
  // Load session data
  const loadSessionData = async (playerId: string) => {
    setLoadingStep('loading_session');
    
    try {
      // Get active session for this player
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')  // Use game_sessions instead of sessions
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          setErrorMessage('No active session found');
        } else {
          console.error('Error loading session:', sessionError);
          setErrorMessage(`Error loading session: ${sessionError.message}`);
        }
        setIsLoading(false);
        return;
      }
      
      if (!sessionData) {
        setErrorMessage('No active session found');
        setIsLoading(false);
        return;
      }
      
      // Set session data
      setCurrentSession(sessionData);
      
      // Set game type
      setGameType(sessionData.game_type || 'mainstage');
      
      // Load game state
      await loadGameState(sessionData.id);
      
      // THE KEY CHANGE: Connect to the session once we have the session ID
      // This single connection will be used by all components
      if (sessionData.id) {
        logWithTimestamp(`Connecting to session ${sessionData.id} from usePlayerGame`, 'info');
        network.connect(sessionData.id);
        
        // Only track presence after a delay
        setTimeout(() => {
          if (playerId && playerCode) {
            const presenceData = {
              player_id: playerId,
              player_code: playerCode,
              nickname: playerName || playerCode,
              last_presence_update: new Date().toISOString()
            };
            network.trackPlayerPresence(presenceData);
          }
        }, 1000);
      }
      
    } catch (error: any) {
      console.error('Error in loadSessionData:', error);
      setErrorMessage(`Error loading session data: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // Load game state
  const loadGameState = async (sessionId: string) => {
    setLoadingStep('loading_game_state');
    
    try {
      // Get session progress
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (progressError) {
        console.error('Error loading session progress:', progressError);
        setErrorMessage(`Error loading game state: ${progressError.message}`);
        setIsLoading(false);
        return;
      }
      
      if (!progressData) {
        setErrorMessage('No game state found');
        setIsLoading(false);
        return;
      }
      
      // Set game state
      setCurrentGameState(progressData);
      
      // Set called numbers
      if (progressData.called_numbers && progressData.called_numbers.length > 0) {
        setCalledItems(progressData.called_numbers);
        setLastCalledItem(progressData.called_numbers[progressData.called_numbers.length - 1]);
      }
      
      // Set win patterns
      if (progressData.current_win_pattern) {
        setActiveWinPatterns([progressData.current_win_pattern]);
        
        // Set prize for this pattern
        if (progressData.current_prize) {
          setWinPrizes({
            [progressData.current_win_pattern]: progressData.current_prize
          });
        }
      }
      
      setLoadingStep('completed');
      setIsLoading(false);
      setErrorMessage(null);
      
    } catch (error: any) {
      console.error('Error in loadGameState:', error);
      setErrorMessage(`Error loading game state: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    setClaimStatus('none');
  }, []);

  // Handle bingo claims
  const handleClaimBingo = useCallback((ticketToSubmit?: any) => {
    if (!playerCode || !currentSession?.id) {
      console.error('Cannot submit bingo claim: missing player code or session');
      setErrorMessage('Missing player code or active session');
      return Promise.resolve(false);
    }
    
    if (isSubmittingClaim) {
      return Promise.resolve(false);
    }

    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      console.log(`Player ${playerCode} claiming bingo in session ${currentSession.id}`);
      
      // If a ticket was provided, use it - otherwise, we'll let the backend handle finding a valid ticket
      const useTicket = ticketToSubmit || (tickets && tickets.length > 0 ? tickets[0] : null);
      
      if (!useTicket) {
        console.error('No ticket available to claim bingo');
        setErrorMessage('No ticket available');
        setIsSubmittingClaim(false);
        setClaimStatus('none');
        return Promise.resolve(false);
      }
      
      // Make sure the ticket has all required fields
      const preparedTicket = {
        serial: useTicket.serial,
        perm: useTicket.perm,
        position: useTicket.position,
        layoutMask: useTicket.layoutMask || useTicket.layout_mask,
        numbers: useTicket.numbers
      };
      
      console.log("Submitting claim with ticket:", preparedTicket);
      
      // Use the network context to submit the claim with the ticket data
      const claimSubmitted = network.submitBingoClaim(preparedTicket, playerCode, currentSession.id);
      
      if (claimSubmitted) {
        // Keep status as pending until we get a response
        console.log('Bingo claim submitted successfully');
        
        // We'll leave the claim status as pending and let the caller handle further UI feedback
        // In a real app, we might want to set a timeout to reset if we don't hear back
        setTimeout(() => {
          if (isMounted.current && claimStatus === 'pending') {
            setClaimStatus('none');
            setIsSubmittingClaim(false);
          }
        }, 10000); // Reset after 10 seconds if no response
        
        return Promise.resolve(true);
      } else {
        console.error('Failed to submit bingo claim');
        setErrorMessage('Failed to submit claim');
        setIsSubmittingClaim(false);
        setClaimStatus('none');
        return Promise.resolve(false);
      }
    } catch (error) {
      console.error('Error claiming bingo:', error);
      setErrorMessage(`Error claiming bingo: ${error}`);
      setIsSubmittingClaim(false);
      setClaimStatus('none');
      return Promise.resolve(false);
    }
  }, [playerCode, currentSession?.id, isSubmittingClaim, claimStatus, network, tickets, playerName]);
  
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
    handleClaimBingo,
    connectionState: network.connectionState
  };
}
