
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import BingoCard from '@/components/game/BingoCard';
import CalledNumbers from '@/components/game/CalledNumbers';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BingoTicket {
  serial: string;
  perm: number;
  position: number;
  layoutMask: number;
  numbers: number[];
  timestamp: string;
}

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
  const { toast } = useToast();
  
  // Get player information from local storage if available
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
  
  // Function to check for active session and fetch tickets
  const checkForActiveSession = async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      console.log("Checking active session for player code:", code);
      // Get the player information first to get their ID
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
        
        // Query sessions to find the player's session
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
          // Format and set as current session
          const formattedSession = {
            id: sessionData.id,
            name: sessionData.name,
            gameType: sessionData.game_type,
            createdBy: sessionData.created_by,
            accessCode: sessionData.access_code,
            status: sessionData.status,
            createdAt: sessionData.created_at,
            sessionDate: sessionData.session_date,
            numberOfGames: sessionData.number_of_games,
          };
          
          setCurrentSession(sessionData.id);
          
          // Fetch player's tickets
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
  
  // Fetch player tickets from the assigned_tickets table
  const fetchPlayerTickets = async (playerId: string, sessionId: string) => {
    try {
      console.log(`Fetching tickets for player ${playerId} in session ${sessionId}`);
      const assignedTickets = await getPlayerAssignedTickets(playerId, sessionId);
        
      if (assignedTickets && assignedTickets.length > 0) {
        console.log(`Found ${assignedTickets.length} tickets:`, assignedTickets);
        // Format the ticket data
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
        console.log("No tickets found for player");
        setErrorMessage("You don't have any tickets assigned. Please contact the game organizer.");
      }
    } catch (error) {
      console.error("Exception fetching tickets:", error);
      setErrorMessage("Failed to load your tickets. The database may not be properly set up.");
    }
  };

  // Listen for called numbers from the server
  useEffect(() => {
    if (!currentSession) return;
    
    // Set up a realtime subscription for called numbers
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

  const handleClaimBingo = () => {
    toast({
      title: "Bingo Claimed!",
      description: "Your claim has been submitted to the caller for verification.",
    });
    // In a real app, this would send a notification to the caller
  };

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-bingo-primary">Bingo Blitz</h1>
            <div className="text-sm text-gray-500">Game: {currentSession.name}</div>
          </div>
          {playerCode && (
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
              Your Code: <span className="font-mono font-bold">{playerCode}</span>
            </div>
          )}
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {tickets.length > 0 ? (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bingo Tickets ({tickets.length})</h2>
                
                {/* Group tickets by perm number for display */}
                {Array.from(new Set(tickets.map(t => t.perm))).map(perm => (
                  <div key={`perm-${perm}`} className="mb-8">
                    <h3 className="text-lg font-semibold mb-3">Strip #{perm}</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {tickets
                        .filter(t => t.perm === perm)
                        .sort((a, b) => a.position - b.position)
                        .map((ticket) => (
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
                            
                            <BingoCard numbers={ticket.numbers} />
                            
                            <Button 
                              className="w-full mt-4 bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
                              onClick={handleClaimBingo}
                            >
                              Claim Bingo!
                            </Button>
                          </div>
                        ))}
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
    </div>
  );
}
