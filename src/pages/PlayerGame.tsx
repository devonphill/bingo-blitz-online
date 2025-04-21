
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
  const { currentSession, sessions, setCurrentSession } = useSession();
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [playerCode, setPlayerCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<BingoTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasCheckedSession, setHasCheckedSession] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Get player information from local storage if available
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
      
      // Check if there's an active session
      const checkForActiveSession = async () => {
        setIsLoading(true);
        
        try {
          // Get the player information first to get their ID
          const { data: playerData } = await supabase
            .from('players')
            .select('id, session_id')
            .eq('player_code', storedPlayerCode)
            .maybeSingle();
            
          if (playerData) {
            setPlayerId(playerData.id);
            
            // Query sessions to find the player's session
            const { data: sessionData } = await supabase
              .from('game_sessions')
              .select('*')
              .eq('id', playerData.session_id)
              .maybeSingle();
              
            if (sessionData && sessionData.status === 'active') {
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
              await fetchPlayerTickets(playerData.id);
              
              toast({
                title: "Game is live!",
                description: `You have joined the ${sessionData.name} game session.`,
              });
            }
          }
        } catch (error) {
          console.error("Error checking for active session:", error);
        } finally {
          setIsLoading(false);
          setHasCheckedSession(true);
        }
      };
      
      // Only run once to prevent constant refreshing
      if (!hasCheckedSession) {
        checkForActiveSession();
      }
    } else {
      setIsLoading(false);
      setHasCheckedSession(true);
    }
  }, [playerCode, hasCheckedSession]);
  
  // Fetch player tickets from the database
  const fetchPlayerTickets = async (playerId: string) => {
    try {
      const { data, error } = await supabase
        .from('bingo_cards')
        .select('*')
        .eq('player_id', playerId);
        
      if (error) {
        console.error("Error fetching tickets:", error);
        return;
      }
      
      if (data && data.length > 0) {
        // Format the ticket data
        const formattedTickets: BingoTicket[] = data.map((ticket: any) => ({
          serial: ticket.id,
          perm: ticket.cells.perm || 1,
          position: ticket.cells.position || 1,
          layoutMask: ticket.cells.layout_mask || 0,
          numbers: ticket.cells.numbers || [],
          timestamp: ticket.created_at
        }));
        
        // Sort tickets by position
        formattedTickets.sort((a, b) => a.position - b.position);
        setTickets(formattedTickets);
      }
    } catch (error) {
      console.error("Exception fetching tickets:", error);
    }
  };

  // Listen for called numbers from the server
  useEffect(() => {
    if (currentSession) {
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
    }
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bingo Tickets</h2>
                <div className="grid grid-cols-1 gap-6">
                  {tickets.map((ticket, index) => (
                    <div key={index} className="border rounded-lg p-4">
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
            ) : (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Your Bingo Card</h2>
                  <Button 
                    className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
                    onClick={handleClaimBingo}
                  >
                    Claim Bingo!
                  </Button>
                </div>
                <BingoCard />
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
