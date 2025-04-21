import React, { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import PlayerTicketsPanel from '@/components/game/PlayerTicketsPanel';

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

export default function PlayerGame() {
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
    return stored ? stored === "true" : true; // default ON
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
  }, [hasCheckedSession]);
  
  const checkForActiveSession = async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      console.log("Checking active session for player code:", code);
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, session_id')
        .eq('player_code', code)
        .maybeSingle();
        
      if (playerError) {
        console.error("Error fetching player data:", playerError);
        setErrorMessage("Unable to find your player information. Please try again or contact support.");
        setIsLoading(false);
        return;
      }
      
      if (playerData) {
        console.log("Found player data:", playerData);
        setPlayerId(playerData.id);
        
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', playerData.session_id)
          .maybeSingle();
          
        if (sessionError) {
          console.error("Error fetching session data:", sessionError);
          setErrorMessage("Unable to find your game session. Please try again or contact support.");
          setIsLoading(false);
          return;
        }
          
        if (sessionData && sessionData.status === 'active') {
          console.log("Found active session:", sessionData);
          setCurrentSession(sessionData.id);
          
          await fetchPlayerTickets(playerData.id, playerData.session_id);
          
          toast({
            title: "Game is live!",
            description: `You have joined the ${sessionData.name} game session.`,
          });
        } else {
          console.log("Session not active or not found");
          setCurrentSession(null);
          if (sessionData) {
            setErrorMessage(`Your game session "${sessionData.name}" is not currently active.`);
          } else {
            setErrorMessage("Could not find your game session.");
          }
        }
      } else {
        console.log("Player not found with code:", code);
        setErrorMessage(`No player found with code ${code}. Please check your code and try again.`);
      }
    } catch (error) {
      console.error("Error checking for active session:", error);
      setErrorMessage("An unexpected error occurred. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchPlayerTickets = async (playerId: string, sessionId: string) => {
    try {
      console.log(`Fetching tickets for player ${playerId} in session ${sessionId}`);
      const assignedTickets = await getPlayerAssignedTickets(playerId, sessionId);
        
      if (assignedTickets && assignedTickets.length > 0) {
        console.log(`Found ${assignedTickets.length} tickets:`, assignedTickets);
        const formattedTickets: BingoTicket[] = assignedTickets.map((ticket) => ({
          serial: ticket.serial,
          perm: ticket.perm,
          position: ticket.position,
          layoutMask: ticket.layout_mask,
          numbers: ticket.numbers,
          timestamp: ticket.created_at
        }));
        
        setTickets(formattedTickets);
      } else {
        console.log("No tickets found for player");
        setErrorMessage("You don't have any tickets assigned. Please contact the game organizer.");
      }
    } catch (error) {
      console.error("Exception fetching tickets:", error);
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
          .eq('session_id', currentSession)
          .order('called_at', { ascending: true });
          
        if (error) {
          console.error("Error fetching called numbers:", error);
          return;
        }
        
        if (data && data.length > 0) {
          const numbers = data.map(item => item.number);
          setCalledNumbers(numbers);
          setCurrentNumber(numbers[numbers.length - 1]);
          console.log(`Loaded ${numbers.length} called numbers from database`);
        }
      } catch (err) {
        console.error("Exception fetching called numbers:", err);
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
          filter: `session_id=eq.${currentSession}`
        },
        (payload) => {
          console.log('New called number received:', payload);
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

  const calcTicketProgress = (numbers: number[], layoutMask: number, calledNumbers: number[]) => {
    const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
    const rows: (number | null)[][] = [[], [], []];
    let nIdx = 0;

    for (let i = 0; i < 27; i++) {
      const row = Math.floor(i / 9);
      if (maskBits[i] === '1') {
        rows[row].push(numbers[nIdx]);
        nIdx++;
      } else {
        rows[row].push(null);
      }
    }

    const lineCounts = rows.map(
      line => line.filter(num => num !== null && calledNumbers.includes(num as number)).length
    );
    const lineNeeded = rows.map(line => line.filter(num => num !== null).length);

    const completedLines = lineCounts.filter((count, idx) => count === lineNeeded[idx]).length;
    const result: { [pattern: string]: number } = {};
    Object.entries(WIN_PATTERNS).forEach(([key, { lines }]) => {
      const linesToGo = Math.max(0, lines - completedLines);
      let minNeeded = Infinity;
      if (linesToGo === 0) {
        minNeeded = 0;
      } else {
        minNeeded = Math.min(
          ...rows
            .map((line, idx) =>
              lineNeeded[idx] - lineCounts[idx]
            )
            .filter(n => n > 0)
        );
        if (minNeeded === Infinity) minNeeded = 0;
      }
      result[key] = minNeeded;
    });
    return result;
  };

  const handleClaimBingo = () => {
    toast({
      title: "Bingo Claimed!",
      description: "Your claim has been submitted to the caller for verification.",
    });
  };

  useEffect(() => {
    localStorage.setItem("bingoAutoMarking", autoMarking.toString());
  }, [autoMarking]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-700 mb-6">{errorMessage}</p>
          <div className="flex justify-center">
            <Button onClick={() => window.location.href = '/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">The caller has not started the game yet.</p>
          <Button onClick={() => window.location.href = '/join'}>
            Join a Different Game
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PlayerGameLayout
      tickets={tickets}
      calledNumbers={calledNumbers}
      currentNumber={currentNumber}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode}
      winPrizes={winPrizes}
      activeWinPatterns={activeWinPatterns}
      onClaimBingo={handleClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
    />
  );
}
