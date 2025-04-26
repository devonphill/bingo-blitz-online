import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessions } from '@/contexts/useSessions';
import { CurrentGameState, GameType, PrizeDetails } from '@/types';

export function usePlayerGame(playerCode?: string | null) {
  const { sessions, isLoading: isSessionLoading, fetchSessions } = useSessions();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<any[]>([]);
  const [calledItems, setCalledItems] = useState<Array<any>>([]);
  const [lastCalledItem, setLastCalledItem] = useState<any | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | undefined>(undefined);

  const currentGameState: CurrentGameState | null = currentSession?.current_game_state ?? null;
  const activeWinPatterns: string[] = currentGameState?.activePatternIds ?? [];
  const winPrizes: { [key: string]: PrizeDetails } = currentGameState?.prizes ?? {};
  const gameType: GameType | null = currentGameState?.gameType ?? currentSession?.gameType ?? null;

  const findSessionById = useCallback((id: string | null) => {
    if (!id || !sessions || sessions.length === 0) return null;
    return sessions.find(s => s.id === id) || null;
  }, [sessions]);

  const handleLoadingError = useCallback((message: string) => {
    console.error('PlayerGame Loading Error:', message);
    setErrorMessage(message);
    setIsLoading(false);
    toast({
      title: 'Game Loading Error',
      description: message,
      variant: 'destructive'
    });
  }, [toast]);

  const fetchPlayerData = useCallback(async () => {
    if (!playerCode) {
      handleLoadingError('No player code provided');
      return false;
    }

    try {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, nickname, session_id')
        .eq('player_code', playerCode)
        .maybeSingle();

      if (playerError) {
        handleLoadingError(`Error finding player: ${playerError.message}`);
        return false;
      }

      if (!playerData) {
        handleLoadingError('Player not found. Invalid player code.');
        return false;
      }

      setPlayerId(playerData.id);
      setPlayerName(playerData.nickname);
      setSessionId(playerData.session_id);

      await fetchSessions();

      const matchingSession = sessions.find(s => s.id === playerData.session_id);
      
      if (!matchingSession) {
        handleLoadingError('No matching game session found');
        return false;
      }

      setCurrentSession(matchingSession);
      
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', playerData.id)
        .eq('session_id', playerData.session_id);

      if (ticketError) {
        handleLoadingError(`Error fetching tickets: ${ticketError.message}`);
        return false;
      }

      if (ticketData && ticketData.length > 0) {
        setTickets(ticketData);
      } else {
        handleLoadingError('No tickets found for this player');
        return false;
      }

      return true;
    } catch (error) {
      handleLoadingError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [playerCode, sessions, fetchSessions, handleLoadingError]);

  useEffect(() => {
    setIsLoading(true);
    fetchPlayerData();
  }, [fetchPlayerData]);

  useEffect(() => {
    if (!sessionId) return;
    
    const matchingSession = findSessionById(sessionId);
    if (matchingSession) {
      console.log("Found updated matching session in sessions array:", matchingSession.id, matchingSession.name);
      setCurrentSession(matchingSession);
      
      if (matchingSession.current_game_state) {
        setCalledItems(matchingSession.current_game_state.calledItems || []);
        setLastCalledItem(matchingSession.current_game_state.lastCalledItem ?? null);
      }
    }
  }, [sessions, sessionId, findSessionById]);

  useEffect(() => {
    if (!sessionId) return;

    console.log(`Setting up real-time subscription for session ${sessionId}`);
    
    const channel = supabase
      .channel(`game-session-changes-${sessionId}`)
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log("Game session update received:", payload);
          if (payload.new) {
            const updatedSession = payload.new as any;
            console.log("Updated session from real-time:", updatedSession);
            setCurrentSession(updatedSession);
            
            if (updatedSession.current_game_state) {
              setCalledItems(updatedSession.current_game_state.calledItems || []);
              setLastCalledItem(updatedSession.current_game_state.lastCalledItem ?? null);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Session subscription status:", status);
      });

    return () => {
      console.log(`Removing real-time subscription for session ${sessionId}`);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!playerId) return;

    console.log(`Setting up claim results subscription for player ${playerId}`);
    
    const gameUpdatesChannel = supabase
      .channel(`game-updates-for-player-${playerId}`)
      .on(
        'broadcast',
        { event: 'claim-result' },
        (payload) => {
          console.log("Received claim result:", payload);
          if (payload.payload && payload.payload.playerId === playerId) {
            const result = payload.payload.result as 'valid' | 'rejected';
            if (result === 'valid') {
              setClaimStatus('validated');
              setIsClaiming(false);
              toast({
                title: "Win Verified!",
                description: "Your bingo win has been verified by the caller.",
                variant: "default"
              });
            } else if (result === 'rejected') {
              setClaimStatus('rejected');
              setIsClaiming(false);
              toast({
                title: "Claim Rejected",
                description: "Your bingo claim was not verified. Please continue playing.",
                variant: "destructive"
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Player ${playerId} subscribed to claim results`);
        }
        if (err) {
          console.error(`Subscription error for player ${playerId}:`, err);
        }
      });

    return () => {
      console.log(`Removing claim results subscription for player ${playerId}`);
      supabase.removeChannel(gameUpdatesChannel)
        .then(() => console.log(`Player ${playerId} unsubscribed from claim results`))
        .catch(err => console.error("Error removing player channel:", err));
    };
  }, [playerId, toast]);

  const handleClaimBingo = useCallback(async (): Promise<boolean> => {
    if (!playerId || !sessionId || !playerName) {
      toast({
        title: "Error",
        description: "Could not claim bingo. Player/Session information missing.",
        variant: "destructive"
      });
      return false;
    }

    if (isClaiming || claimStatus === 'validated') {
      toast({
        title: "Claim Status",
        description: claimStatus === 'validated' ? "Your win is already validated." : "Your claim is already being processed.",
        variant: "default"
      });
      return false;
    }

    setIsClaiming(true);
    setClaimStatus('pending');

    try {
      console.log(`Player ${playerName} (${playerId}) claiming bingo in session ${sessionId}`);

      const { data: claimData, error: claimError } = await supabase
        .from('bingo_claims')
        .insert({
          player_id: playerId,
          session_id: sessionId,
          status: 'pending'
        })
        .select('id')
        .single();

      if (claimError || !claimData) {
        console.error("Error creating claim record:", claimError);
        setIsClaiming(false);
        setClaimStatus(undefined);
        throw new Error(`Failed to save claim: ${claimError?.message || 'Unknown error'}`);
      }

      console.log(`Claim recorded with ID: ${claimData.id}. Broadcasting...`);

      const broadcastResponse = await supabase
        .channel('caller-claims')
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            playerId,
            playerName,
            sessionId,
            claimId: claimData.id,
            timestamp: new Date().toISOString()
          }
        });

      if(!broadcastResponse) {
        console.error("Error broadcasting claim: No response received");
        toast({
          title: "Claim Submitted (Broadcast Issue)",
          description: "Your claim was saved but might be delayed notifying the caller.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Claim Submitted",
          description: "Your bingo claim is being verified by the caller.",
          variant: "default"
        });
      }

      return true;
    } catch (error) {
      console.error("Error claiming bingo:", error);
      setIsClaiming(false);
      setClaimStatus(undefined);
      toast({
        title: "Error",
        description: `Failed to submit your bingo claim: ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive"
      });
      return false;
    }
  }, [playerId, sessionId, playerName, toast, isClaiming, claimStatus]);

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
    gameType,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    handleClaimBingo,
    isClaiming,
    claimStatus,
  };
}
