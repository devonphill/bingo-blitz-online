// src/hooks/usePlayerGame.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSessions } from '@/contexts/useSessions';
import { CurrentGameState } from '@/types';

export function usePlayerGame(playerCode?: string | null) {
  const { currentSession: sessionFromContext, isLoading: isSessionLoading } = useSessions();

  const [tickets, setTickets] = useState<any[]>([]);
  const [calledItems, setCalledItems] = useState<Array<any>>([]);
  const [lastCalledItem, setLastCalledItem] = useState<any | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoMarking, setAutoMarking] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | undefined>(undefined);

  const { toast } = useToast();

  const currentGameState: CurrentGameState | null = sessionFromContext?.current_game_state ?? null;
  const activeWinPatterns: string[] = currentGameState?.activePatternIds ?? [];
  const winPrizes: { [key: string]: string } = currentGameState?.prizes ?? {};
  const gameType: string | null = currentGameState?.gameType ?? sessionFromContext?.gameType ?? null;

  useEffect(() => {
    if (!playerCode) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPlayerData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      setTickets([]);
      setPlayerId(null);
      setPlayerName('');
      setSessionId(null);
      setClaimStatus(undefined);
      setIsClaiming(false);

      try {
        console.log("Fetching player data for code:", playerCode);

        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, session_id')
          .eq('player_code', playerCode)
          .maybeSingle();

        if (!isMounted) return;

        if (playerError || !playerData) {
          console.error("Error fetching player or player not found:", playerError);
          setErrorMessage(playerError?.message || 'Player not found or invalid code');
          setIsLoading(false);
          return;
        }

        console.log("Player found:", playerData.nickname, "session:", playerData.session_id);
        setPlayerId(playerData.id);
        setPlayerName(playerData.nickname);
        setSessionId(playerData.session_id);

        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*')
          .eq('player_id', playerData.id)
          .eq('session_id', playerData.session_id);

        if (!isMounted) return;

        if (ticketError) {
          console.error("Error fetching tickets:", ticketError);
          setErrorMessage('Could not load your tickets');
          setIsLoading(false);
          return;
        }

        const transformedTickets = ticketData?.map(ticket => ({
          ...ticket,
          layoutMask: ticket.layout_mask
        })) || [];

        setTickets(transformedTickets);

        const { data: claimData, error: claimError } = await supabase
          .from('bingo_claims')
          .select('status')
          .eq('player_id', playerData.id)
          .eq('session_id', playerData.session_id)
          .order('claimed_at', { ascending: false })
          .limit(1);

        if (!isMounted) return;

        if (!claimError && claimData && claimData.length > 0) {
          const latestStatus = claimData[0].status as 'pending' | 'validated' | 'rejected';
          setClaimStatus(latestStatus);
          if (latestStatus === 'pending') {
            setIsClaiming(true);
          }
        }

        setIsLoading(false);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error in fetchPlayerData:", error);
        setErrorMessage('Failed to load initial player data');
        setIsLoading(false);
      }
    };

    fetchPlayerData();

    return () => {
      isMounted = false;
    };
  }, [playerCode]);

  useEffect(() => {
    if (sessionFromContext && sessionFromContext.id === sessionId) {
      if (sessionFromContext.current_game_state) {
        setCalledItems(sessionFromContext.current_game_state.calledItems || []);
        setLastCalledItem(sessionFromContext.current_game_state.lastCalledItem ?? null);
      } else {
        setCalledItems([]);
        setLastCalledItem(null);
      }
      setIsLoading(isSessionLoading);
      setErrorMessage('');
    } else if (sessionId && !sessionFromContext) {
      // Handle case where we have a session ID but no context
    }
  }, [sessionFromContext, sessionId, isSessionLoading]);

  useEffect(() => {
    if (!playerId) return;

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
    currentSession: sessionFromContext,
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
