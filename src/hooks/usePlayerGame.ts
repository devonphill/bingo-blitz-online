
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameSession, GameState, Ticket, GameType, GameConfig } from '@/types';
import { parseGameConfigs } from '@/types';

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
  const [gameType, setGameType] = useState<GameType>('mainstage');
  
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
        
        // Create GameSession object with proper typing
        const gameConfigs = parseGameConfigs(sessionData.games_config);
        
        setCurrentSession({
          id: sessionData.id,
          name: sessionData.name,
          gameType: sessionData.game_type as GameType,
          createdBy: sessionData.created_by,
          accessCode: sessionData.access_code,
          status: sessionData.status as 'pending' | 'active' | 'completed',
          createdAt: sessionData.created_at,
          sessionDate: sessionData.session_date,
          numberOfGames: sessionData.number_of_games,
          current_game: sessionData.current_game,
          lifecycle_state: sessionData.lifecycle_state as 'setup' | 'live' | 'ended' | 'completed',
          games_config: gameConfigs
        });
        
        // Set game type correctly
        setGameType(sessionData.game_type as GameType);
        
        // For now, skip fetching current_game_state since it doesn't exist in the table
        // We'll use sessions_progress instead
        
        setLoadingStep('fetching-tickets');
        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('player_id', playerData.id);
          
        if (ticketError) {
          throw new Error(`Tickets not found: ${ticketError?.message || 'Unknown error'}`);
        }
        
        // Map database ticket fields to our Ticket interface
        const mappedTickets: Ticket[] = (ticketData || []).map(ticket => ({
          id: ticket.id,
          playerId: ticket.player_id,
          sessionId: ticket.session_id,
          numbers: ticket.numbers,
          serial: ticket.serial,
          position: ticket.position,
          layoutMask: ticket.layout_mask,
          perm: ticket.perm
        }));
        
        setTickets(mappedTickets);
        
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

  const handleClaimBingo = useCallback(async (ticketInfo: Ticket): Promise<boolean> => {
    if (!currentSession || !playerId) return false;
    
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful claim
      setClaimStatus('validated');
      toast({
        title: "Claim Validated",
        description: "Your bingo claim has been validated!",
      });
      
      return true;
    } catch (err) {
      setClaimStatus('rejected');
      toast({
        title: "Claim Rejected",
        description: "Your bingo claim was not valid. Please check your card and try again.",
        variant: "destructive"
      });
      return false;
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
    submitClaim: handleClaimBingo,
    isSubmittingClaim
  };
}
