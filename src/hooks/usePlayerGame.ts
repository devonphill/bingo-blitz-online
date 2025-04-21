
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';

interface BingoTicket {
  serial: string;
  perm: number;
  position: number;
  layoutMask: number;
  numbers: number[];
  timestamp: string;
}

interface WinPatternRow {
  id: string;
  session_id: string;
  one_line_active: boolean;
  one_line_prize: string | null;
  two_lines_active: boolean;
  two_lines_prize: string | null;
  full_house_active: boolean;
  full_house_prize: string | null;
  created_at: string;
}

export function usePlayerGame() {
  const { currentSession, setCurrentSession, getPlayerAssignedTickets } = useSession();
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [playerCode, setPlayerCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<BingoTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasCheckedSession, setHasCheckedSession] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeWinPatterns, setActiveWinPatterns] = useState<string[]>(["oneLine", "twoLines", "fullHouse"]);
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({
    oneLine: "",
    twoLines: "",
    fullHouse: ""
  });
  const [autoMarking, setAutoMarking] = useState<boolean>(() => {
    const stored = localStorage.getItem("bingoAutoMarking");
    return stored ? stored === "true" : true;
  });
  const { toast } = useToast();

  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (storedPlayerCode && !hasCheckedSession) {
      setPlayerCode(storedPlayerCode);
      checkForActiveSession(storedPlayerCode);
      setHasCheckedSession(true);
    } else if (!storedPlayerCode) {
      setIsLoading(false);
      setHasCheckedSession(true);
    }
    // eslint-disable-next-line
  }, [hasCheckedSession]);

  const checkForActiveSession = async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, session_id')
        .eq('player_code', code)
        .maybeSingle();

      if (playerError) {
        setErrorMessage("Unable to find your player information. Please try again or contact support.");
        setIsLoading(false);
        return;
      }

      if (playerData) {
        setPlayerId(playerData.id);
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', playerData.session_id)
          .maybeSingle();

        if (sessionError) {
          setErrorMessage("Unable to find your game session. Please try again or contact support.");
          setIsLoading(false);
          return;
        }

        if (sessionData && sessionData.status === 'active') {
          setCurrentSession(sessionData.id);
          await fetchPlayerTickets(playerData.id, playerData.session_id);

          toast({
            title: "Game is live!",
            description: `You have joined the ${sessionData.name} game session.`,
          });
        } else {
          setCurrentSession(null);
          if (sessionData) {
            setErrorMessage(`Your game session "${sessionData.name}" is not currently active.`);
          } else {
            setErrorMessage("Could not find your game session.");
          }
        }
      } else {
        setErrorMessage(`No player found with code ${code}. Please check your code and try again.`);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlayerTickets = async (playerId: string, sessionId: string) => {
    try {
      const assignedTickets = await getPlayerAssignedTickets(playerId, sessionId);

      if (assignedTickets && assignedTickets.length > 0) {
        const formattedTickets: BingoTicket[] = assignedTickets.map((ticket: any) => ({
          serial: ticket.serial,
          perm: ticket.perm,
          position: ticket.position,
          layoutMask: ticket.layout_mask,
          numbers: ticket.numbers,
          timestamp: ticket.created_at
        }));

        setTickets(formattedTickets);
      } else {
        setErrorMessage("You don't have any tickets assigned. Please contact the game organizer.");
      }
    } catch (error) {
      setErrorMessage("Failed to load your tickets. Please try refreshing the page or contact support.");
    }
  };

  useEffect(() => {
    if (!currentSession) return;

    const fetchCalledNumbers = async () => {
      try {
        const { data, error } = await supabase
          .from('called_numbers')
          .select('number')
          .eq('session_id', typeof currentSession === 'string' ? currentSession : currentSession.id)
          .order('called_at', { ascending: true });

        if (error) {
          return;
        }

        if (data && data.length > 0) {
          const numbers = data.map((item: any) => item.number);
          setCalledNumbers(numbers);
          setCurrentNumber(numbers[numbers.length - 1]);
        }
      } catch (err) {
        // do nothing
      }
    };

    const fetchWinPatterns = async () => {
      try {
        // Cast supabase to any to get around missing type info for win_patterns:
        const winPatternsQuery = (supabase as any)
          .from('win_patterns')
          .select('*')
          .eq('session_id', typeof currentSession === 'string' ? currentSession : currentSession.id)
          .order('created_at', { ascending: false });
          
        const { data, error } = await winPatternsQuery;

        if (error || !data) return;
        
        if (data.length > 0) {
          // Use the shape from interface WinPatternRow, safely:
          const latest = data[0] as WinPatternRow;
          const activePatterns: string[] = [];
          const prizes: { [key: string]: string } = {};

          if (latest.one_line_active) {
            activePatterns.push("oneLine");
            prizes.oneLine = latest.one_line_prize || "";
          }

          if (latest.two_lines_active) {
            activePatterns.push("twoLines");
            prizes.twoLines = latest.two_lines_prize || "";
          }

          if (latest.full_house_active) {
            activePatterns.push("fullHouse");
            prizes.fullHouse = latest.full_house_prize || "";
          }

          setActiveWinPatterns(activePatterns);
          setWinPrizes(prizes);
        }
      } catch (err) {
        // do nothing
      }
    };

    fetchCalledNumbers();
    fetchWinPatterns();

    const channel = supabase
      .channel('called-numbers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_numbers',
          filter: `session_id=eq.${typeof currentSession === 'string' ? currentSession : currentSession.id}`
        },
        (payload) => {
          if (payload.new && typeof payload.new.number === 'number') {
            const newNumber = payload.new.number;
            setCurrentNumber(newNumber);
            setCalledNumbers(prev => {
              if (prev.includes(newNumber)) return prev;
              return [...prev, newNumber];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession]);

  useEffect(() => {
    localStorage.setItem("bingoAutoMarking", autoMarking.toString());
  }, [autoMarking]);

  const handleClaimBingo = async () => {
    if (!playerId || !currentSession) return;

    try {
      // Get the player's tickets for validation
      const ticketData = tickets.map(ticket => ({
        serial: ticket.serial,
        numbers: ticket.numbers,
        layout_mask: ticket.layoutMask
      }));

      // Cast supabase to any to bypass type limitation for bingo_claims
      const insertResult = await (supabase as any)
        .from('bingo_claims')
        .insert({
          player_id: playerId,
          session_id: typeof currentSession === 'string' ? currentSession : currentSession.id,
          claimed_at: new Date().toISOString(),
          status: 'pending',
          ticket_data: ticketData // Adding ticket data for validation
        });

      const { error } = insertResult;

      if (error) {
        toast({
          title: "Failed to submit claim",
          description: "There was an error submitting your bingo claim. Please try again.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Claim Submitted!",
        description: "Your claim has been submitted to the caller for verification.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };

  return {
    calledNumbers,
    currentNumber,
    playerCode,
    tickets,
    isLoading,
    errorMessage,
    currentSession,
    autoMarking,
    setAutoMarking,
    winPrizes,
    activeWinPatterns,
    handleClaimBingo,
  };
}

// NOTE: This file is getting very long (~300 lines).
// Consider breaking it up into smaller focused hooks for maintainability.
