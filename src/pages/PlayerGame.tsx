
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import BingoCard from '@/components/game/BingoCard';
import CalledNumbers from '@/components/game/CalledNumbers';

export default function PlayerGame() {
  const { currentSession } = useSession();
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  
  // In a real app, these would be updated via Socket.IO
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

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No active session</h2>
          <Button onClick={() => window.location.href = '/'}>
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
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <BingoCard />
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
