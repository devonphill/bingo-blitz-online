import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import BingoCard from '@/components/game/BingoCard';
import CalledNumbers from '@/components/game/CalledNumbers';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from "@/components/ui/switch";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import CurrentNumberDisplay from '@/components/game/CurrentNumberDisplay';

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
    
    const channel = supabase
      .channel('called-numbers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'called_numbers',
          filter: `session_id=eq.${currentSession.id}`
        },
        (payload) => {
          console.log('Called number received:', payload);
          if (payload.new && typeof payload.new.number === 'number') {
            setCurrentNumber(payload.new.number);
            setCalledNumbers(prev => [...prev, payload.new.number]);
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <div>
            <h1 className="text-xl font-bold text-bingo-primary">Bingo Blitz</h1>
            <div className="text-sm text-gray-500">Game: {currentSession?.name}</div>
            {activeWinPatterns.length > 0 && (
              <div className="mt-1">
                <span className="text-xs text-gray-500 font-medium">
                  Win Pattern: {activeWinPatterns.map(key => 
                    <span key={key} className="inline-block mr-2 px-2 py-1 bg-blue-50 rounded text-bingo-primary">
                      {WIN_PATTERNS[key]?.label ?? key}
                      {winPrizes[key] ? `: ${winPrizes[key]}` : ""}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch id="auto-marking"
                checked={autoMarking}
                onCheckedChange={setAutoMarking}
              />
              <label htmlFor="auto-marking" className="text-sm font-medium">
                Auto Marking
              </label>
            </div>
            {playerCode && (
              <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                Your Code: <span className="font-mono font-bold">{playerCode}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-64px)] w-full">
        <ResizablePanel defaultSize={30} minSize={24} maxSize={40} className="bg-transparent flex flex-col h-full">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-2"></div>
            <div className="aspect-square w-full max-w-[100%] p-2 flex items-center justify-center">
              <CurrentNumberDisplay number={currentNumber} />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70} minSize={55} className="overflow-y-auto">
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Button 
              className="w-full mb-4 bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
              onClick={handleClaimBingo}
            >
              Claim Bingo!
            </Button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                {tickets.length > 0 ? (
                  <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bingo Tickets ({tickets.length})</h2>
                    {Array.from(new Set(tickets.map(t => t.perm))).map(perm => (
                      <div key={`perm-${perm}`} className="mb-8">
                        <h3 className="text-lg font-semibold mb-3">Strip #{perm}</h3>
                        <div className="grid grid-cols-1 gap-6">
                          {tickets
                            .filter(t => t.perm === perm)
                            .sort((a, b) => a.position - b.position)
                            .map((ticket) => {
                              const winProg = calcTicketProgress(ticket.numbers, ticket.layoutMask, calledNumbers);
                              const minToGo = Math.min(...activeWinPatterns.map(p => winProg[p] ?? 15));
                              return (
                                <div key={ticket.serial} className="border rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-medium">
                                      Perm: <span className="font-mono">{ticket.perm}</span>
                                    </div>
                                    <div className="text-sm font-medium">
                                      Position: <span className="font-mono">{ticket.position}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500 mb-4">
                                    Serial: <span className="font-mono">{ticket.serial}</span>
                                  </div>
                                  <BingoCard
                                    numbers={ticket.numbers}
                                    layoutMask={ticket.layoutMask}
                                    calledNumbers={calledNumbers}
                                    autoMarking={autoMarking}
                                  />
                                  <div className="text-center mt-4">
                                    <span className={minToGo <= 3 ? "font-bold text-green-600" : "font-medium text-gray-700"}>
                                      {minToGo === 0
                                        ? "Bingo!"
                                        : `${minToGo} to go`}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900">No Tickets Assigned</h2>
                    </div>
                    <p className="text-gray-600">You don't have any tickets assigned yet. Please wait for the game organizer to assign tickets.</p>
                  </div>
                )}
              </div>
              <div>
                <div className="bg-white shadow rounded-lg p-6">
                  <CalledNumbers 
                    calledNumbers={calledNumbers}
                    currentNumber={currentNumber}
                  />
                </div>
              </div>
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
