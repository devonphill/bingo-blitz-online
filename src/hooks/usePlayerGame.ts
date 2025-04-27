import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession, GameState, Ticket } from '@/types';

export function usePlayerGame(playerCode: string | null | undefined) {
  // State for player info
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [playerName, setPlayerName] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('initializing');
  
  // State for game
  const [calledItems, setCalledItems] = useState<number[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [winPrizes, setWinPrizes] = useState<any>({});
  const [autoMarking, setAutoMarking] = useState(true);
  const [gameType, setGameType] = useState<string>('mainstage');
  
  // State for claim handling
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | null>(null);
  
  const { toast } = useToast();
  
  // Implement loading player data, game state, tickets, etc.
  useEffect(() => {
    async function loadPlayerData() {
      if (!playerCode) {
        setErrorMessage('Player code is missing.');
        setIsLoading(false);
        setLoadingStep('completed');
        return;
      }
      
      setIsLoading(true);
      setLoadingStep('fetching-player');
      
      try {
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('player_code', playerCode)
          .single();
          
        if (playerError || !playerData) {
          throw new Error(`Player not found: ${playerError?.message || 'Unknown error'}`);
        }
        
        setPlayerName(playerData.nickname);
        setPlayerId(playerData.id);
        
        const sessionId = playerData.session_id;
        
        setLoadingStep('fetching-session');
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (sessionError || !sessionData) {
          throw new Error(`Session not found: ${sessionError?.message || 'Unknown error'}`);
        }
        
        setCurrentSession({
          id: sessionData.id,
          name: sessionData.name,
          gameType: sessionData.game_type,
          createdBy: sessionData.created_by,
          accessCode: sessionData.access_code,
          status: sessionData.status,
          createdAt: sessionData.created_at,
          sessionDate: sessionData.session_date,
          numberOfGames: sessionData.number_of_games,
          current_game: sessionData.current_game,
          lifecycle_state: sessionData.lifecycle_state,
          games_config: sessionData.games_config,
          current_game_state: sessionData.current_game_state
        });
        setGameType(sessionData.game_type);
        
        setLoadingStep('fetching-game-state');
        const { data: gameStateData, error: gameStateError } = await supabase
          .from('game_sessions')
          .select('current_game_state')
          .eq('id', sessionId)
          .single();
          
        if (gameStateError || !gameStateData) {
          console.warn(`Game state not found: ${gameStateError?.message || 'Unknown error'}`);
        } else {
          setCurrentGameState(gameStateData.current_game_state as GameState);
          
          if (gameStateData.current_game_state) {
            setCalledItems(gameStateData.current_game_state.calledItems || []);
            setLastCalledItem(gameStateData.current_game_state.lastCalledItem || null);
            setActiveWinPatterns(gameStateData.current_game_state.activePatternIds || []);
            setWinPrizes(gameStateData.current_game_state.prizes || {});
          }
        }
        
        setLoadingStep('fetching-tickets');
        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('player_id', playerData.id);
          
        if (ticketError) {
          throw new Error(`Tickets not found: ${ticketError?.message || 'Unknown error'}`);
        }
        
        setTickets(ticketData as Ticket[]);
        
      } catch (err) {
        setErrorMessage((err as Error).message);
        console.error('Error loading player data:', err);
      } finally {
        setIsLoading(false);
        setLoadingStep('completed');
      }
    }
    
    loadPlayerData();
  }, [playerCode]);

  const handleClaimBingo = useCallback(async (ticketInfo: Ticket) => {
    if (!currentSession || !playerId) return;
    
    setIsSubmittingClaim(true);
    setClaimStatus('pending');
    
    try {
      if (!activeWinPatterns || activeWinPatterns.length === 0) {
        throw new Error('No active win patterns defined for this game.');
      }
      
      const winPatternId = activeWinPatterns[0];
      
      toast({
        title: "Submitting Claim",
        description: "Submitting your bingo claim...",
      });
      
      // Simulate claim submission
      setTimeout(() => {
        // Simulate successful claim
        setClaimStatus('validated');
        toast({
          title: "Claim Validated",
          description: "Your bingo claim has been validated!",
        });
      }, 3000);
      
    } catch (err) {
      setClaimStatus('rejected');
      toast({
        title: "Claim Rejected",
        description: "Your bingo claim was not valid. Please check your card and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingClaim(false);
    }
  }, [currentSession, playerId, activeWinPatterns, toast]);

  const resetClaimStatus = useCallback(() => {
    setClaimStatus(null);
  }, []);

  // Return all necessary properties and functions
  return {
    tickets,
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
    handleClaimBingo,
    isClaiming: isSubmittingClaim,
    claimStatus,
    gameType,
    loadingStep,
    resetClaimStatus,
    submitClaim: async (winPatternId: string, ticketData: any) => {
      return true;
    },
    isSubmittingClaim
  };
}
