
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerJoinForm from '@/components/player/PlayerJoinForm';
import { Button } from '@/components/ui/button';
import { logWithTimestamp } from '@/utils/logUtils';
import { usePlayerContext } from '@/contexts/PlayerContext';

export default function PlayerJoin() {
  const navigate = useNavigate();
  const [hasStoredCode, setHasStoredCode] = useState(false);
  const [storedCode, setStoredCode] = useState<string | null>(null);
  const { player, setPlayer } = usePlayerContext();
  
  // Check if player already has a code stored
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName') || 'Player';
    
    if (storedPlayerCode && storedPlayerCode.trim() !== '' && storedPlayerId) {
      logWithTimestamp(`PlayerJoin: Found existing player code: ${storedPlayerCode}`, 'info');
      setHasStoredCode(true);
      setStoredCode(storedPlayerCode);
      
      // Update the player context with the stored data
      if (!player) {
        setPlayer({
          id: storedPlayerId,
          name: storedPlayerName,
          code: storedPlayerCode,
          sessionId: localStorage.getItem('playerSessionId')
        });
        logWithTimestamp('PlayerJoin: Updated player context with stored data', 'info');
      }
    } else {
      // Clean up any invalid stored codes
      localStorage.removeItem('playerCode');
      localStorage.removeItem('playerId');
      localStorage.removeItem('playerName');
      localStorage.removeItem('playerSessionId');
      logWithTimestamp('PlayerJoin: No valid stored player code found', 'info');
    }
  }, [player, setPlayer]);

  // Function to handle continuing with stored code
  const handleContinueWithStoredCode = () => {
    if (storedCode && storedCode.trim() !== '') {
      logWithTimestamp(`PlayerJoin: Navigating to game with stored code: ${storedCode}`, 'info');
      navigate(`/player/game/${storedCode}`);
    }
  };

  // Function to start fresh with a new code
  const handleUseNewCode = () => {
    localStorage.removeItem('playerCode');
    localStorage.removeItem('playerId');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerSessionId');
    setHasStoredCode(false);
    setStoredCode(null);
    logWithTimestamp('PlayerJoin: Cleared stored player code', 'info');
  };

  if (hasStoredCode && storedCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-bingo-dark mb-2">Bingo Blitz</h1>
            <p className="text-gray-600">Welcome back!</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <p className="text-center mb-6">
              You already have a stored player code: <strong>{storedCode}</strong>
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={handleContinueWithStoredCode} 
                className="w-full bg-bingo-primary hover:bg-bingo-primary/90"
              >
                Continue to Game
              </Button>
              
              <Button 
                onClick={handleUseNewCode} 
                variant="outline" 
                className="w-full"
              >
                Use a Different Code
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-bingo-dark mb-2">Bingo Blitz</h1>
          <p className="text-gray-600">Join a game session</p>
        </div>
        <PlayerJoinForm />
      </div>
    </div>
  );
}
