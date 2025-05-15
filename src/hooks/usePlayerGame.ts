import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBingoSync } from '@/hooks/useBingoSync';
import { useTickets } from '@/hooks/useTickets';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp, logError } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { logReactEnvironment } from '@/utils/reactUtils';

export function usePlayerGame(playerCode: string | null) {
  // Create a logger specifically for this hook
  const logger = (message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info', data?: any) => {
    try {
      const instanceId = instanceIdRef.current;
      const fullMessage = data 
        ? `[PlayerGame ${instanceId}] ${message}: ${JSON.stringify(data, null, 2)}`
        : `[PlayerGame ${instanceId}] ${message}`;
      logWithTimestamp(fullMessage, level);
    } catch (e) {
      // If JSON stringification fails, log without the data
      logWithTimestamp(`[PlayerGame] ${message} (data could not be stringified)`, 'error');
    }
  };

  // Log React environment info on initialization
  useEffect(() => {
    logReactEnvironment();
  }, []);

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
  const instanceIdRef = useRef(`playerGame-${Math.random().toString(36).substring(2, 9)}`);
  
  // Debug log on initialization
  useEffect(() => {
    logger('Hook initialized with player code', 'info', { playerCode });
    
    // Add error handler for uncaught errors
    const errorHandler = (event: ErrorEvent) => {
      logger('Uncaught error in PlayerGame hook', 'error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    
    window.addEventListener('error', errorHandler);
    
    return () => {
      logger('Hook unmounting', 'info');
      window.removeEventListener('error', errorHandler);
      isMounted.current = false;
    };
  }, []);
  
  // Load auto-marking preference from localStorage
  useEffect(() => {
    try {
      const savedAutoMarking = localStorage.getItem('autoMarking');
      if (savedAutoMarking !== null) {
        setAutoMarking(savedAutoMarking === 'true');
        logger('Auto marking preference loaded from localStorage', 'debug', { autoMarking: savedAutoMarking === 'true' });
      }
    } catch (error) {
      logger('Error loading auto marking preference', 'error', { error });
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
      logger('Game state updated', 'debug', gameState);
      
      // Update called numbers if they've changed
      if (gameState.calledNumbers && gameState.calledNumbers.length > 0) {
        setCalledItems(gameState.calledNumbers);
        logger('Called numbers updated', 'debug', { count: gameState.calledNumbers.length });
      }
      
      // Update last called number if it's changed
      if (gameState.lastCalledNumber !== null) {
        setLastCalledItem(gameState.lastCalledNumber);
        logger('Last called number updated', 'debug', { number: gameState.lastCalledNumber });
      }
      
      // Update win pattern if it's changed
      if (gameState.currentWinPattern) {
        setActiveWinPatterns([gameState.currentWinPattern]);
        logger('Win pattern updated', 'debug', { pattern: gameState.currentWinPattern });
      }
      
      // Update prizes if they've changed
      if (gameState.currentPrize && gameState.currentWinPattern) {
        setWinPrizes(prev => ({
          ...prev,
          [gameState.currentWinPattern]: gameState.currentPrize
        }));
        logger('Prize updated', 'debug', { 
          pattern: gameState.currentWinPattern, 
          prize: gameState.currentPrize 
        });
      }
    }
  }, [gameState]);
  
  // Handle connection errors
  useEffect(() => {
    if (bingoSyncError) {
      logger('Bingo sync connection error', 'error', { error: bingoSyncError });
      setErrorMessage(`Connection error: ${bingoSyncError}`);
    }
  }, [bingoSyncError]);
  
  // Load player data
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!playerCode) {
        logger('No player code provided', 'warn');
        setErrorMessage('Player code is required');
        setIsLoading(false);
        return;
      }
      
      logger(`Loading player data for code: ${playerCode}`, 'info');
      setLoadingStep('loading_player');
      
      try {
        // Get player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('player_code', playerCode)
          .single();
        
        if (playerError) {
          logger('Error loading player', 'error', { error: playerError });
          setErrorMessage(`Error loading player: ${playerError.message}`);
          setIsLoading(false);
          return;
        }
        
        if (!playerData) {
          logger('Player not found', 'error', { playerCode });
          setErrorMessage('Player not found');
          setIsLoading(false);
          return;
        }
        
        logger('Player data loaded', 'info', { playerData });
        
        // Set player data - use nickname instead of name
        setPlayerName(playerData.nickname || playerData.player_code);
        setPlayerId(playerData.id);
        
        // Load session data
        await loadSessionData(playerData.id);
      } catch (error: any) {
        logger('Error in loadPlayerData', 'error', { error: error.message });
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
    logger(`Loading session data for player ID: ${playerId}`, 'info');
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
          logger('No active session found', 'warn');
          setErrorMessage('No active session found');
        } else {
          logger('Error loading session', 'error', { error: sessionError });
          setErrorMessage(`Error loading session: ${sessionError.message}`);
        }
        setIsLoading(false);
        return;
      }
      
      if (!sessionData) {
        logger('No active session data returned', 'warn');
        setErrorMessage('No active session found');
        setIsLoading(false);
        return;
      }
      
      logger('Session data loaded', 'info', { sessionData });
      
      // Set session data
      setCurrentSession(sessionData);
      
      // Set game type
      setGameType(sessionData.game_type || 'mainstage');
      
      // Load game state with error handling
      try {
        await loadGameState(sessionData.id);
      } catch (error: any) {
        logger('Error in loadGameState', 'error', { error });
        setErrorMessage(`Error loading game state: ${error.message}`);
        setIsLoading(false);
      }
      
      // THE KEY CHANGE: Connect to the session once we have the session ID
      // This single connection will be used by all components
      if (sessionData.id) {
        logger(`Connecting to session ${sessionData.id}`, 'info');
        try {
          network.connect(sessionData.id);
        } catch (error: any) {
          logger('Error connecting to session', 'error', { error });
          // Non-fatal error, continue loading
        }
        
        // Only track presence after a delay
        setTimeout(() => {
          if (playerId && playerCode && isMounted.current) {
            const presenceData = {
              player_id: playerId,
              player_code: playerCode,
              nickname: playerName || playerCode,
              last_presence_update: new Date().toISOString()
            };
            
            logger('Updating player presence', 'debug', { presenceData });
            
            // Use the updatePlayerPresence method directly instead of trackPlayerPresence
            network.updatePlayerPresence(presenceData)
              .catch(err => {
                logger('Error updating player presence', 'error', { error: err });
              });
          }
        }, 1000);
      }
      
    } catch (error: any) {
      logError(error as Error, 'loadSessionData', { playerId });
      logger('Error in loadSessionData', 'error', { error: error.message, stack: error.stack });
      setErrorMessage(`Error loading session data: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // Load game state
  const loadGameState = async (sessionId: string) => {
    logger(`Loading game state for session: ${sessionId}`, 'info');
    setLoadingStep('loading_game_state');
    
    try {
      // Get session progress
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (progressError) {
        logger('Error loading session progress', 'error', { error: progressError });
        setErrorMessage(`Error loading game state: ${progressError.message}`);
        setIsLoading(false);
        return;
      }
      
      if (!progressData) {
        logger('No game state found', 'warn');
        setErrorMessage('No game state found');
        setIsLoading(false);
        return;
      }
      
      logger('Game state loaded', 'info', { progressData });
      
      // Set game state
      setCurrentGameState(progressData);
      
      // Set called numbers
      if (progressData.called_numbers && progressData.called_numbers.length > 0) {
        setCalledItems(progressData.called_numbers);
        setLastCalledItem(progressData.called_numbers[progressData.called_numbers.length - 1]);
        logger('Called numbers loaded', 'debug', { 
          count: progressData.called_numbers.length,
          last: progressData.called_numbers[progressData.called_numbers.length - 1]
        });
      }
      
      // Set win patterns
      if (progressData.current_win_pattern) {
        setActiveWinPatterns([progressData.current_win_pattern]);
        logger('Win pattern loaded', 'debug', { pattern: progressData.current_win_pattern });
        
        // Set prize for this pattern
        if (progressData.current_prize) {
          setWinPrizes({
            [progressData.current_win_pattern]: progressData.current_prize
          });
          logger('Prize loaded', 'debug', { 
            pattern: progressData.current_win_pattern,
            prize: progressData.current_prize
          });
        }
      }
      
      setLoadingStep('completed');
      setIsLoading(false);
      setErrorMessage(null);
      
    } catch (error: any) {
      logger('Error in loadGameState', 'error', { error: error.message });
      setErrorMessage(`Error loading game state: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // Reset claim status
  const resetClaimStatus = useCallback(() => {
    logger('Resetting claim status', 'debug');
    setClaimStatus('none');
  }, []);

  // Handle bingo claims
  const handleClaimBingo = useCallback((ticketToSubmit?: any) => {
    if (!playerCode || !currentSession?.id) {
      logger('Cannot submit bingo claim: missing player code or session', 'error');
      setErrorMessage('Missing player code or active session');
      return Promise.resolve(false);
    }
    
    if (isSubmittingClaim) {
      logger('Bingo claim already in progress', 'warn');
      return Promise.resolve(false);
    }

    logger('Submitting bingo claim', 'info', { playerCode, sessionId: currentSession.id });
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      // If a ticket was provided, use it - otherwise, we'll let the backend handle finding a valid ticket
      const useTicket = ticketToSubmit || (tickets && tickets.length > 0 ? tickets[0] : null);
      
      if (!useTicket) {
        logger('No ticket available to claim bingo', 'error');
        setErrorMessage('No ticket available');
        setIsSubmittingClaim(false);
        setClaimStatus('none');
        return Promise.resolve(false);
      }
      
      // Make sure the ticket has all required fields
      const preparedTicket = {
        serial: useTicket.serial || useTicket.id, // Try to use id as fallback if serial is missing
        perm: useTicket.perm,
        position: useTicket.position,
        layoutMask: useTicket.layoutMask || useTicket.layout_mask,
        numbers: useTicket.numbers
      };
      
      // Add detailed debug logging of the claim payload
      console.log('CLAIM DEBUG - Original ticket:', useTicket);
      console.log('CLAIM DEBUG - Prepared ticket for claim:', preparedTicket);
      console.log('CLAIM DEBUG - Ticket fields available:', {
        id: useTicket.id,
        serial: useTicket.serial,
        hasId: !!useTicket.id,
        hasSerial: !!useTicket.serial,
        hasPerm: !!useTicket.perm,
        usedSerial: preparedTicket.serial
      });
      
      logger('Submitting claim with ticket', 'info', { ticket: preparedTicket });
      
      // Use the network context to submit the claim with the ticket data
      const claimSubmitted = network.submitBingoClaim(preparedTicket, playerCode, currentSession.id);
      
      if (claimSubmitted) {
        // Keep status as pending until we get a response
        logger('Bingo claim submitted successfully', 'info');
        
        // We'll leave the claim status as pending and let the caller handle further UI feedback
        // In a real app, we might want to set a timeout to reset if we don't hear back
        setTimeout(() => {
          if (isMounted.current && claimStatus === 'pending') {
            logger('Claim response timed out, resetting claim status', 'warn');
            setClaimStatus('none');
            setIsSubmittingClaim(false);
          }
        }, 10000); // Reset after 10 seconds if no response
        
        return Promise.resolve(true);
      } else {
        logger('Failed to submit bingo claim', 'error');
        setErrorMessage('Failed to submit claim');
        setIsSubmittingClaim(false);
        setClaimStatus('none');
        return Promise.resolve(false);
      }
    } catch (error: any) {
      logger('Error claiming bingo', 'error', { error: error.message });
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
