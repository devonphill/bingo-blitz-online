
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerJoinForm from '@/components/player/PlayerJoinForm';
import { Button } from '@/components/ui/button';
import { logWithTimestamp } from '@/utils/logUtils';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export default function PlayerJoin() {
  const navigate = useNavigate();
  const [hasStoredCode, setHasStoredCode] = useState(false);
  const [storedCode, setStoredCode] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { player, setPlayer } = usePlayerContext();
  
  // Check if player already has a code stored and validate it with the database
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName') || 'Player';
    const storedSessionId = localStorage.getItem('playerSessionId');
    
    if (storedPlayerCode && storedPlayerCode.trim() !== '') {
      logWithTimestamp(`PlayerJoin: Found existing player code: ${storedPlayerCode}`, 'info');
      setHasStoredCode(true);
      setStoredCode(storedPlayerCode);
      
      // If we don't have all required data in localStorage, verify with Supabase
      if (!storedPlayerId || !storedSessionId) {
        verifyPlayerCodeWithDatabase(storedPlayerCode);
      } else if (!player) {
        // Update the player context with the stored data
        setPlayer({
          id: storedPlayerId,
          name: storedPlayerName,
          code: storedPlayerCode,
          sessionId: storedSessionId
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

  // Verify the stored player code with the database
  const verifyPlayerCodeWithDatabase = async (code: string) => {
    setIsVerifying(true);
    try {
      logWithTimestamp(`PlayerJoin: Verifying player code ${code} with database`, 'info');
      
      const { data: playerData, error } = await supabase
        .from('players')
        .select('id, nickname, session_id')
        .eq('player_code', code)
        .single();
      
      if (error || !playerData) {
        logWithTimestamp(`PlayerJoin: Failed to verify player code: ${error?.message || 'Player not found'}`, 'error');
        toast({
          title: "Invalid Player Code",
          description: "Your stored player code is no longer valid. Please enter a new code.",
          variant: "destructive"
        });
        handleUseNewCode(); // Clear the stored code
        return;
      }
      
      // Update localStorage with verified data
      localStorage.setItem('playerId', playerData.id);
      localStorage.setItem('playerName', playerData.nickname || 'Player');
      localStorage.setItem('playerSessionId', playerData.session_id);
      
      // Update the player context
      setPlayer({
        id: playerData.id,
        name: playerData.nickname || 'Player',
        code,
        sessionId: playerData.session_id
      });
      
      logWithTimestamp(`PlayerJoin: Successfully verified player code and updated context with sessionId: ${playerData.session_id}`, 'info');
    } catch (err) {
      logWithTimestamp(`PlayerJoin: Error during code verification: ${(err as Error).message}`, 'error');
      handleUseNewCode(); // Clear the stored code if there's an error
    } finally {
      setIsVerifying(false);
    }
  };

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
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Continue to Game'}
              </Button>
              
              <Button 
                onClick={handleUseNewCode} 
                variant="outline" 
                className="w-full"
                disabled={isVerifying}
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
