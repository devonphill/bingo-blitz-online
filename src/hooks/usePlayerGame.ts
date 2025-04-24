// src/hooks/usePlayerGame.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// Assuming SessionProvider or similar provides session context, or import useSessions directly
import { useSessions } from '@/contexts/useSessions'; // Import useSessions
import { CurrentGameState } from '@/types'; // Import the game state type

export function usePlayerGame(playerCode?: string | null) {
  // Use useSessions hook to get session context
  const { currentSession: sessionFromContext, isLoading: isSessionLoading } = useSessions();

  const [tickets, setTickets] = useState<any[]>([]); // Consider defining a proper ticket type
  const [calledItems, setCalledItems] = useState<Array<any>>([]); // Generic item array
  const [lastCalledItem, setLastCalledItem] = useState<any | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoMarking, setAutoMarking] = useState<boolean>(true); // Keep this local UI state
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  // Remove local state for win prizes/patterns, get from context
  // const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({});
  // const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'validated' | 'rejected' | undefined>(undefined);
  // Remove local gameType state, get from context
  // const [gameType, setGameType] = useState<string>('90-ball');

  const { toast } = useToast();

  // Extract derived state from context for easier use
  const currentGameState: CurrentGameState | null = sessionFromContext?.current_game_state ?? null;
  const activeWinPatterns: string[] = currentGameState?.activePatternIds ?? [];
  const winPrizes: { [key: string]: string } = currentGameState?.prizes ?? {};
  const gameType: string | null = currentGameState?.gameType ?? sessionFromContext?.gameType ?? null; // Fallback logic

  // Effect to fetch initial player-specific data (tickets, name, initial claim status)
  useEffect(() => {
    if (!playerCode) {
      setIsLoading(false); // Not loading if no player code
      return;
    }

    let isMounted = true; // Prevent state updates on unmounted component
    const fetchPlayerData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      setTickets([]);
      setPlayerId(null);
      setPlayerName('');
      setSessionId(null); // Reset session ID on player code change
      setClaimStatus(undefined);
      setIsClaiming(false);

      try {
        console.log("Fetching player data for code:", playerCode);

        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, nickname, session_id') // Select only needed fields initially
          .eq('player_code', playerCode)
          .maybeSingle(); // Use maybeSingle to handle not found gracefully

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
        setSessionId(playerData.session_id); // Session ID is now known

        // Fetch tickets associated with this player and session
        const { data: ticketData, error: ticketError } = await supabase
          .from('assigned_tickets')
          .select('*') // Adjust select as needed
          .eq('player_id', playerData.id)
          .eq('session_id', playerData.session_id);

         if (!isMounted) return;

        if (ticketError) {
          console.error("Error fetching tickets:", ticketError);
          setErrorMessage('Could not load your tickets');
          setIsLoading(false); // Still might have session info
          return; // Stop if tickets fail, or allow partial load?
        }

        // Assuming ticket transformation is needed (e.g., layout_mask)
        // Define a proper type for TransformedTicket if possible
        const transformedTickets = ticketData?.map(ticket => ({
          ...ticket,
          // Example transformation, adjust as needed based on ticket structure
          layoutMask: ticket.layout_mask
        })) || [];

        setTickets(transformedTickets);

        // Check for existing claim status for this player/session
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

        // Initial loading complete (session data comes from context now)
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
      isMounted = false; // Cleanup function to prevent setting state on unmount
    };

  }, [playerCode]); // Only refetch player data when playerCode changes

  // Effect to synchronize with session state from context
  useEffect(() => {
    if (sessionFromContext && sessionFromContext.id === sessionId) {
       // Update local state based on context's current_game_state
        if (sessionFromContext.current_game_state) {
            setCalledItems(sessionFromContext.current_game_state.calledItems || []);
            setLastCalledItem(sessionFromContext.current_game_state.lastCalledItem ?? null);
            // No need to set activeWinPatterns/winPrizes/gameType locally, use derived state
        } else {
            // Handle case where context has session but no game state (reset local)
            setCalledItems([]);
            setLastCalledItem(null);
        }
        setIsLoading(isSessionLoading); // Reflect session loading state
        setErrorMessage(''); // Clear previous errors if session is now valid
    } else if (sessionId && !sessionFromContext) {
        // Handle case where we have a session ID but no context (e.g., context cleared)
        // setErrorMessage("Session data not available.");
        // setIsLoading(true); // Or false, depending on desired behavior
    }
  }, [sessionFromContext, sessionId, isSessionLoading]);


  // Effect for real-time claim results (independent of session context state)
  useEffect(() => {
    // Only subscribe if we have a player ID
    if (!playerId) return;

    const gameUpdatesChannel = supabase
      .channel(`game-updates-for-player-${playerId}`) // Player-specific channel name
      .on(
        'broadcast',
        { event: 'claim-result' },
        (payload) => {
          console.log("Received claim result:", payload);
          // Check if the result is specifically for this player
          if (payload.payload && payload.payload.playerId === playerId) {
            const result = payload.payload.result as 'valid' | 'rejected'; // Type assertion

            if (result === 'valid') { // Use 'valid' instead of 'validated' from broadcast
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

    // Cleanup
    return () => {
      supabase.removeChannel(gameUpdatesChannel)
          .then(() => console.log(`Player ${playerId} unsubscribed from claim results`))
          .catch(err => console.error("Error removing player channel:", err));
    };
  }, [playerId, toast]); // Depend only on playerId and toast

  // Claim Bingo function (remains largely the same, uses local playerId/sessionId)
  const handleClaimBingo = useCallback(async (): Promise<boolean> => {
    if (!playerId || !sessionId || !playerName) {
      toast({
        title: "Error",
        description: "Could not claim bingo. Player/Session information missing.",
        variant: "destructive"
      });
      return false;
    }
    // Prevent double-claiming if already pending or recently resolved
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

      // Insert the claim record
      const { data: claimData, error: claimError } = await supabase
        .from('bingo_claims')
        .insert({
          player_id: playerId,
          session_id: sessionId,
          status: 'pending' // Ensure status is set correctly
        })
        .select('id') // Select the ID of the new claim
        .single();

      if (claimError || !claimData) {
        console.error("Error creating claim record:", claimError);
        // Attempt to rollback optimistic state change
        setIsClaiming(false);
        setClaimStatus(undefined); // Revert status
        throw new Error(`Failed to save claim: ${claimError?.message || 'Unknown error'}`);
      }

       console.log(`Claim recorded with ID: ${claimData.id}. Broadcasting...`);

      // Broadcast the claim event *after* successful DB insert
      const broadcastResponse = await supabase
        .channel('caller-claims') // Ensure this channel name matches useClaimManagement
        .send({
          type: 'broadcast',
          event: 'bingo-claim',
          payload: {
            playerId,
            playerName,
            sessionId,
            claimId: claimData.id, // Send the actual claim ID
            timestamp: new Date().toISOString()
          }
        });

      // Handle potential broadcast errors without accessing the non-existent error property
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

      return true; // Claim successfully submitted

    } catch (error) {
      console.error("Error claiming bingo:", error);
      // Rollback optimistic state changes if not already done
      setIsClaiming(false);
      setClaimStatus(undefined);

      toast({
        title: "Error",
        description: `Failed to submit your bingo claim: ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive"
      });

      return false; // Claim failed
    }
  }, [playerId, sessionId, playerName, toast, isClaiming, claimStatus]); // Add isClaiming/claimStatus dependency

  // Return derived state from context along with local state/handlers
  return {
    // Player/Ticket Data
    tickets,
    playerName,
    playerId, // Exposed for potential use

    // Game State (derived from context)
    currentSession: sessionFromContext, // Provide the full session context object
    currentGameState, // Provide the specific game state object
    calledItems, // Use generic name
    lastCalledItem, // Use generic name
    activeWinPatterns, // Derived from context
    winPrizes, // Derived from context
    gameType, // Derived from context

    // Local UI State
    autoMarking,
    setAutoMarking,
    isLoading, // Combined loading state
    errorMessage,

    // Claim State & Handler
    handleClaimBingo,
    isClaiming,
    claimStatus,
  };
}
