
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from '@/contexts/SessionContext';
import CallerControls from '@/components/game/CallerControls';
import CalledNumbers from '@/components/game/CalledNumbers';

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, players } = useSession();
  const [session, setSession] = useState(sessions.find(s => s.id === sessionId) || null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      setSession(sessions.find(s => s.id === sessionId) || null);
    }
  }, [sessionId, sessions, session]);

  useEffect(() => {
    // Initialize the remaining numbers for a 90-ball game
    // In a real app, this would depend on the game type
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    setRemainingNumbers(allNumbers);
  }, []);

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
    // In a real app, this would verify a player's winning claim
    toast({
      title: "Verifying Claim",
      description: "No claims to verify at this time.",
    });
  };

  const handleEndGame = () => {
    // In a real app, this would end the game and update the session status
    toast({
      title: "Game Ended",
      description: "The game session has been ended.",
    });
    
    navigate('/dashboard');
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
          </div>
          
          <div>
            <CallerControls 
              onCallNumber={handleCallNumber}
              onVerifyClaim={handleVerifyClaim}
              onEndGame={handleEndGame}
              remainingNumbers={remainingNumbers}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
