
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from '@/contexts/SessionContext';
import CallerControls from '@/components/game/CallerControls';
import CalledNumbers from '@/components/game/CalledNumbers';
import { supabase } from '@/integrations/supabase/client';

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, players } = useSession();
  const [session, setSession] = useState(sessions.find(s => s.id === sessionId) || null);
  const [gameType, setGameType] = useState('90-ball');
  const [promptGameType, setPromptGameType] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [bingoTickets, setBingoTickets] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      setSession(sessions.find(s => s.id === sessionId) || null);
    }
  }, [sessionId, sessions, session]);

  useEffect(() => {
    // Prompt for game type selection on load (but focus on 90-ball only for now)
    setPromptGameType(true);
  }, [sessionId]);

  // Initialize numbers pool for 90-ball game
  useEffect(() => {
    if (gameType === "90-ball" && remainingNumbers.length === 0) {
      setRemainingNumbers(Array.from({ length: 90 }, (_, i) => i + 1));
    }
  }, [gameType, remainingNumbers.length]);

  const handleGameTypeChange = (type: string) => {
    setGameType(type);
    setPromptGameType(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (promptGameType) {
    // Only allow "90-ball" for now
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white shadow p-8 rounded-lg max-w-xs w-full text-center">
          <h2 className="text-2xl font-bold mb-3">Select Game Type</h2>
          <Button
            className="w-full mb-2"
            onClick={() => handleGameTypeChange('90-ball')}
          >
            90-Ball Bingo
          </Button>
          {/* Add more options once implemented */}
        </div>
      </div>
    );
  }

  const sessionPlayers = players.filter(p => p.sessionId === sessionId);

  const handleCallNumber = (number: number) => {
    setCurrentNumber(number);
    setCalledNumbers([...calledNumbers, number]);
    setRemainingNumbers(remainingNumbers.filter(n => n !== number));
    
    toast({
      title: "Number Called",
      description: `Called number: ${number}`,
    });
  };

  const handleVerifyClaim = () => {
    toast({
      title: "Verifying Claim",
      description: "No claims to verify at this time.",
    });
  };

  const handleEndGame = () => {
    toast({
      title: "Game Ended",
      description: "The game session has been ended.",
    });
    
    navigate('/dashboard');
  };

  // --- GO LIVE LOGIC ---
  const handleGoLive = async () => {
    if (!session) return;
    // 1. Update session status to 'active'
    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId);

    if (updateError) {
      toast({
        title: 'Failed to Go Live',
        description: updateError.message,
        variant: 'destructive',
      });
      return;
    }
    // 2. Fetch bingo tickets for this session (from bingo_cards)
    // Here we assume bingo_cards.player_id is linked to players.id and players.session_id = sessionId
    const { data: sessionPlayersData, error: playerErr } = await supabase
      .from('players')
      .select('id,player_code,nickname')
      .eq('session_id', sessionId);

    if (playerErr) {
      toast({
        title: 'Failed to load players',
        description: playerErr.message,
        variant: 'destructive',
      });
      return;
    }

    // Gather ticket info from bingo_cards table per player
    let allTickets: any[] = [];
    if (sessionPlayersData && sessionPlayersData.length) {
      // For each player, fetch their cards (can be optimized; simple for now)
      for (const player of sessionPlayersData) {
        const { data: tickets, error: ticketErr } = await supabase
          .from('bingo_cards')
          .select('id,cells')
          .eq('player_id', player.id);

        if (ticketErr) {
          toast({
            title: `Failed to load tickets for ${player.nickname}`,
            description: ticketErr.message,
            variant: 'destructive',
          });
          continue;
        }
        if (tickets && tickets.length) {
          // Optionally map structure according to your demo tickets (add perm number if applicable)
          allTickets.push({
            playerId: player.id,
            playerCode: player.player_code,
            nickname: player.nickname,
            tickets,
          });
        }
      }
    }
    setBingoTickets(allTickets);

    toast({
      title: 'Game is live!',
      description: 'Bringing players into the game and fetching their tickets.',
    });

    // Optionally: update players UI or state here to bring them from lobby into the game
    // For a real-time effect, you would broadcast this change (Socket.IO/Supabase Realtime).
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-bingo-primary">Bingo Blitz</h1>
            <div className="text-sm text-gray-500">Session: {session.name}</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
              Access Code: <span className="font-mono font-bold">{session.accessCode}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Game: {session.gameType}</h2>
              <CalledNumbers 
                calledNumbers={calledNumbers}
                currentNumber={currentNumber}
              />
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Players ({sessionPlayers.length})</h2>
              {sessionPlayers.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  No players have joined yet. Share the access code.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sessionPlayers.map(player => (
                    <div key={player.id} className="bg-gray-50 p-3 rounded-md">
                      <div className="font-medium">{player.nickname}</div>
                      <div className="text-xs text-gray-500">
                        Joined {new Date(player.joinedAt).toLocaleTimeString()}
                      </div>
                      <div className="text-xs font-mono mt-1">
                        Code: {player.playerCode}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Optionally, show fetched tickets for debug/demo */}
            {bingoTickets.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mt-6">
                <h3 className="font-semibold mb-3">Bingo Tickets (Debug)</h3>
                <pre className="text-xs max-h-40 overflow-auto">{JSON.stringify(bingoTickets, null, 2)}</pre>
              </div>
            )}
          </div>
          
          <div>
            <CallerControls 
              onCallNumber={handleCallNumber}
              onVerifyClaim={handleVerifyClaim}
              onEndGame={handleEndGame}
              onGoLive={handleGoLive}
              remainingNumbers={remainingNumbers}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
