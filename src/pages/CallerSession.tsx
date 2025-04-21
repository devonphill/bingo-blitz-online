import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from '@/contexts/SessionContext';
import CallerControls from '@/components/game/CallerControls';
import CalledNumbers from '@/components/game/CalledNumbers';
import { supabase } from '@/integrations/supabase/client';
import GameHeader from '@/components/game/GameHeader';
import PlayerList from '@/components/game/PlayerList';
import TicketsDebugDisplay from '@/components/game/TicketsDebugDisplay';
import WinPatternSelector from "@/components/game/WinPatternSelector";

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, players, assignTicketsToPlayer } = useSession();
  const [session, setSession] = useState(sessions.find(s => s.id === sessionId) || null);
  const [gameType, setGameType] = useState('90-ball');
  const [promptGameType, setPromptGameType] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [bingoTickets, setBingoTickets] = useState<any[]>([]);
  const [winPatterns, setWinPatterns] = useState<string[]>(["oneLine", "twoLines", "fullHouse"]);
  const [winPrizes, setWinPrizes] = useState<{ [key: string]: string }>({
    oneLine: "",
    twoLines: "",
    fullHouse: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      setSession(sessions.find(s => s.id === sessionId) || null);
    }
  }, [sessionId, sessions, session]);

  useEffect(() => {
    setPromptGameType(true);
  }, [sessionId]);

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

  const handleGoLive = async () => {
    if (!session) return;
    
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
    
    const { data: sessionPlayersData, error: playerErr } = await supabase
      .from('players')
      .select('id,player_code,nickname,tickets')
      .eq('session_id', sessionId);

    if (playerErr) {
      toast({
        title: 'Failed to load players',
        description: playerErr.message,
        variant: 'destructive',
      });
      return;
    }

    if (sessionPlayersData && sessionPlayersData.length) {
      toast({
        title: 'Assigning tickets to players',
        description: `Assigning tickets to ${sessionPlayersData.length} players...`,
      });
      
      for (const player of sessionPlayersData) {
        const { data: existingTicketsData } = await supabase
          .from('assigned_tickets')
          .select('perm')
          .eq('player_id', player.id)
          .eq('session_id', sessionId);
          
        // Get unique perm values
        const uniquePerms = existingTicketsData ? [...new Set(existingTicketsData.map(item => item.perm))] : [];
        const permsCount = uniquePerms.length;
        
        if (permsCount < player.tickets) {
          console.log(`Assigning ${player.tickets - permsCount} more strips to ${player.nickname}`);
          await assignTicketsToPlayer(player.id, sessionId, player.tickets);
        }
      }
    }

    const { data: allAssignedTickets, error: ticketsErr } = await supabase
      .from('assigned_tickets')
      .select(`
        id, serial, perm, position, layout_mask, numbers,
        players:player_id(id, player_code, nickname)
      `)
      .eq('session_id', sessionId)
      .order('perm, position');

    if (ticketsErr) {
      console.error("Error loading tickets:", ticketsErr);
    } else if (allAssignedTickets) {
      const groupedTickets: any[] = [];
      const playerMap = new Map();
      
      allAssignedTickets.forEach(ticket => {
        const player = ticket.players;
        if (!playerMap.has(player.id)) {
          playerMap.set(player.id, {
            playerId: player.id,
            playerCode: player.player_code,
            nickname: player.nickname,
            tickets: []
          });
          groupedTickets.push(playerMap.get(player.id));
        }
        
        playerMap.get(player.id).tickets.push({
          id: ticket.id,
          serial: ticket.serial,
          perm: ticket.perm,
          position: ticket.position,
          layoutMask: ticket.layout_mask,
          numbers: ticket.numbers
        });
      });
      
      setBingoTickets(groupedTickets);
    }

    toast({
      title: 'Game is live!',
      description: 'Players can now join the game.',
    });
  };

  const handleTogglePattern = (pattern: string) => {
    setWinPatterns(prev =>
      prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern]
    );
  };
  const handlePrizeChange = (pattern: string, value: string) => {
    setWinPrizes(prev => ({ ...prev, [pattern]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <GameHeader sessionName={session.name} accessCode={session.accessCode} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Game: {session.gameType}</h2>
              <div className="mb-4">
                <WinPatternSelector
                  selectedPatterns={winPatterns}
                  onTogglePattern={handleTogglePattern}
                  prizeValues={winPrizes}
                  onPrizeChange={handlePrizeChange}
                />
              </div>
              <CalledNumbers 
                calledNumbers={calledNumbers}
                currentNumber={currentNumber}
              />
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Players ({sessionPlayers.length})</h2>
              <PlayerList players={sessionPlayers.map(p => ({
                id: p.id,
                nickname: p.nickname,
                joinedAt: p.joinedAt,
                playerCode: p.playerCode
              }))} />
            </div>
            <TicketsDebugDisplay bingoTickets={bingoTickets} />
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
