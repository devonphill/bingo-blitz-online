
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import BingoCard from '@/components/game/BingoCard';
import CalledNumbers from '@/components/game/CalledNumbers';
import { useToast } from '@/components/ui/use-toast';

export default function PlayerGame() {
  const { currentSession, players } = useSession();
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [playerCode, setPlayerCode] = useState<string>('');
  const { toast } = useToast();
  
  // Get player information from local storage if available
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
    }
  }, []);
  
  // In a real app, these would be updated via Socket.IO or Supabase Realtime
  useEffect(() => {
    // Simulate receiving called numbers
    const interval = setInterval(() => {
      if (calledNumbers.length < 90) {
        let newNumber;
        do {
          newNumber = Math.floor(Math.random() * 90) + 1;
        } while (calledNumbers.includes(newNumber));
        
        setCurrentNumber(newNumber);
        setCalledNumbers(prev => [...prev, newNumber]);
      } else {
        clearInterval(interval);
      }
    }, 10000); // Call a number every 10 seconds
    
    return () => clearInterval(interval);
  }, [calledNumbers]);

  const handleClaimBingo = () => {
    toast({
      title: "Bingo Claimed!",
      description: "Your claim has been submitted to the caller for verification.",
    });
    // In a real app, this would send a notification to the caller
  };

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No active session</h2>
          <Button onClick={() => window.location.href = '/join'}>
            Join a Game
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
