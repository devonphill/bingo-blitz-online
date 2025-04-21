
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

const WIN_PATTERNS: { [key: string]: { label: string; lines: number } } = {
  oneLine: { label: "One Line", lines: 1 },
  twoLines: { label: "Two Lines", lines: 2 },
  fullHouse: { label: "Full House", lines: 3 }
};

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

    fetchCalledNumbers();

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

  const handleClaimBingo = () => {
    toast({
      title: "Bingo Claimed!",
      description: "Your claim has been submitted to the caller for verification.",
    });
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
