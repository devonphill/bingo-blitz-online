
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
        console.log('Player code is missing');
        setErrorMessage('Player code is missing. Please join using your player code.');
        setIsLoading(false);
        setLoadingStep('completed');
        return;
      }
      
      setIsLoading(true);
      setLoadingStep('fetching-player');
      console.log('Loading player data for player code:', playerCode);
      
      try {
        // Query to fetch player data by player_code
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('player_code', playerCode)
          .single();
          
        if (playerError || !playerData) {
          console.error('Error fetching player:', playerError);
          throw new Error(`Player not found: ${playerError?.message || 'Unknown error'}`);
        }
        
        console.log('Found player data:', playerData);
        setPlayerName(playerData.nickname);
        setPlayerId(playerData.id);
        
        const sessionId = playerData.session_id;
        if (!sessionId) {
          console.error('No session ID in player data');
          throw new Error('No session ID associated with player');
        }
        
        console.log('Fetching session data for session ID:', sessionId);
        setLoadingStep('fetching-session');
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (sessionError || !sessionData) {
          console.error('Error fetching session:', sessionError);
          throw new Error(`Session not found: ${sessionError?.message || 'Unknown error'}`);
        }
        
        console.log('Found session data:', sessionData);
        
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
        
        // Now fetch session progress to get active win patterns and called numbers
        console.log('Fetching session progress for session ID:', sessionId);
        setLoadingStep('fetching-progress');
        const { data: progressData, error: progressError } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();
          
        if (progressData) {
          console.log('Found session progress:', progressData);
          setCalledItems(progressData.called_numbers || []);
          
          if (progressData.called_numbers?.length > 0) {
            setLastCalledItem(progressData.called_numbers[progressData.called_numbers.length - 1]);
          }
          
          if (progressData.current_win_pattern) {
            setActiveWinPatterns([progressData.current_win_pattern]);
          }
        } else if (progressError) {
          console.warn('Error fetching session progress:', progressError);
          // Not failing on this error as it's not critical
        }
        
        // For now, skip fetching current_game_state since it doesn't exist in the table
        // We'll use sessions_progress instead
        
        setLoadingStep('fetching-tickets');
        console.log('Fetching tickets for player ID:', playerData.id);
        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('player_id', playerData.id);
          
        if (ticketError) {
          console.error('Error fetching tickets:', ticketError);
          throw new Error(`Tickets not found: ${ticketError?.message || 'Unknown error'}`);
        }

        if (!ticketData || ticketData.length === 0) {
          console.warn('No tickets found for player');
          toast({
            title: "No tickets found",
            description: "You don't have any tickets assigned yet. Contact the game organizer.",
            variant: "default"
          });
        } else {
          console.log(`Found ${ticketData.length} tickets for player`);
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
        console.log('Player game setup complete');
        
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error('Error in loadPlayerData:', errorMsg, err);
        setErrorMessage(errorMsg);
      } finally {
        setIsLoading(false);
        setLoadingStep('completed');
        console.log('Loading player data completed. Loading state set to false.');
      }
    }
    
    loadPlayerData();
  }, [playerCode, toast]);

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
