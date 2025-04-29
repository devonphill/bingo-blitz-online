
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerJoinForm from '@/components/player/PlayerJoinForm';
import { Button } from '@/components/ui/button';

export default function PlayerJoin() {
  const navigate = useNavigate();
  const [hasStoredCode, setHasStoredCode] = useState(false);
  const [storedCode, setStoredCode] = useState<string | null>(null);
  
  // Check if player already has a code stored
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (storedPlayerCode && storedPlayerCode.trim() !== '') {
      console.log("Found existing player code:", storedPlayerCode);
      setHasStoredCode(true);
      setStoredCode(storedPlayerCode);
    } else {
      // Clean up any invalid stored codes
      localStorage.removeItem('playerCode');
    }
  }, []);

  // Function to handle continuing with stored code
  const handleContinueWithStoredCode = () => {
    if (storedCode && storedCode.trim() !== '') {
      console.log("Navigating to game with stored code:", storedCode);
      navigate(`/player/game/${storedCode}`);
    }
  };

  // Function to start fresh with a new code
  const handleUseNewCode = () => {
    localStorage.removeItem('playerCode');
    setHasStoredCode(false);
    setStoredCode(null);
    console.log("Cleared stored player code");
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
