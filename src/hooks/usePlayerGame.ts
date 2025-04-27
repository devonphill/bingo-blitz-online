
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [loadingStep, setLoadingStep] = useState<string>("initializing");
  const dataFullyLoadedOnce = useRef(false);
  const claimResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setLoadingStep("finding player");
      console.log(`Finding player with code: ${playerCode}`);
      
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
      
      setLoadingStep("fetching sessions");
      console.log(`Found player ${playerData.nickname} (${playerData.id}) in session ${playerData.session_id}`);
      
      await fetchSessions();

      setLoadingStep("finding matching session");
      console.log("Looking for matching session in loaded sessions...");
      
      const matchingSession = sessions.find(s => s.id === playerData.session_id);
      
      if (!matchingSession) {
        console.error("No matching session found in sessions array:", sessions.map(s => s.id));
        handleLoadingError('No matching game session found');
        return false;
      }

      console.log("Found matching session:", matchingSession.id, matchingSession.name);
      setCurrentSession(matchingSession);
      
      setLoadingStep("fetching tickets");
      console.log(`Fetching tickets for player ${playerData.id} in session ${playerData.session_id}`);
      
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
        console.log(`Found ${ticketData.length} tickets for player`);
        setTickets(ticketData);
        dataFullyLoadedOnce.current = true;
        setLoadingStep("completed");
        return true;
      } else {
        handleLoadingError('No tickets found for this player');
        return false;
      }
    } catch (error) {
      handleLoadingError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [playerCode, sessions, fetchSessions, handleLoadingError]);

  useEffect(() => {
    if (!dataFullyLoadedOnce.current) {
      setIsLoading(true);
      setErrorMessage(null);
      
      const timer = setTimeout(() => {
        fetchPlayerData();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [fetchPlayerData]);

  useEffect(() => {
    if (!sessionId) return;
    
    const matchingSession = findSessionById(sessionId);
    if (matchingSession) {
      console.log("Found updated matching session in sessions array:", matchingSession.id, matchingSession.name);
      
      if (JSON.stringify(currentSession) !== JSON.stringify(matchingSession)) {
        setCurrentSession(matchingSession);
        
        if (matchingSession.current_game_state) {
          const newCalledItems = matchingSession.current_game_state.calledItems || [];
          if (JSON.stringify(calledItems) !== JSON.stringify(newCalledItems)) {
            setCalledItems(newCalledItems);
          }
          
          const newLastCalledItem = matchingSession.current_game_state.lastCalledItem ?? null;
          if (lastCalledItem !== newLastCalledItem) {
            setLastCalledItem(newLastCalledItem);
          }
        }
      }
    }
  }, [sessions, sessionId, findSessionById, currentSession, calledItems, lastCalledItem]);

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
            
            if (JSON.stringify(currentSession) !== JSON.stringify(updatedSession)) {
              setCurrentSession(updatedSession);
              
              if (updatedSession.current_game_state) {
                const newCalledItems = updatedSession.current_game_state.calledItems || [];
                if (JSON.stringify(calledItems) !== JSON.stringify(newCalledItems)) {
                  setCalledItems(newCalledItems);
                }
                
                const newLastCalledItem = updatedSession.current_game_state.lastCalledItem ?? null;
                if (lastCalledItem !== newLastCalledItem) {
                  setLastCalledItem(newLastCalledItem);
                }
              }
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
  }, [sessionId, currentSession, calledItems, lastCalledItem]);

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
            
            // Immediately update claiming status
            setIsClaiming(false);
            
            if (result === 'valid') {
              setClaimStatus('validated');
              toast({
                title: "Win Verified!",
                description: "Your bingo win has been verified by the caller.",
                variant: "default"
              });
              
              // Reset claim status after delay
              if (claimResetTimer.current) {
                clearTimeout(claimResetTimer.current);
              }
              
              claimResetTimer.current = setTimeout(() => {
                console.log("Resetting claim status from validated");
                setClaimStatus(undefined);
              }, 5000);
            } else if (result === 'rejected') {
              setClaimStatus('rejected');
              toast({
                title: "Claim Rejected",
                description: "Your bingo claim was not verified. Please continue playing.",
                variant: "destructive"
              });
              
              // Reset claim status after delay
              if (claimResetTimer.current) {
                clearTimeout(claimResetTimer.current);
              }
              
              claimResetTimer.current = setTimeout(() => {
                console.log("Resetting claim status from rejected");
                setClaimStatus(undefined);
              }, 5000);
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
      if (claimResetTimer.current) {
        clearTimeout(claimResetTimer.current);
      }
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
            timestamp: new Date().toISOString(),
            gameType: gameType || 'mainstage',
            winPatterns: activeWinPatterns,
            ticketCount: tickets.length
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
  }, [playerId, sessionId, playerName, toast, isClaiming, claimStatus, gameType, activeWinPatterns, tickets.length]);

  const resetClaimStatus = useCallback(() => {
    setClaimStatus(undefined);
    setIsClaiming(false);
  }, []);

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
    loadingStep,
    resetClaimStatus,
  };
}
