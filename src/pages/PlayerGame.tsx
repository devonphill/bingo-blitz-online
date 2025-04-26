
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { Button } from '@/components/ui/button';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import BingoWinProgress from '@/components/game/BingoWinProgress';
import { GameType } from '@/types';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (urlPlayerCode) {
      setPlayerCode(urlPlayerCode);
      localStorage.setItem('playerCode', urlPlayerCode);
    } else if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
    } else {
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/join');
    }
  }, [urlPlayerCode, navigate, toast]);

  const {
    tickets,
    playerName,
    playerId,
    currentSession,
    currentGameState,
    calledItems, 
    lastCalledItem,
    activeWinPatterns,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    handleClaimBingo,
    isClaiming,
    claimStatus,
    gameType,
  } = usePlayerGame(playerCode);

  console.log("PlayerGame - Current session:", currentSession);
  console.log("PlayerGame - Session state:", currentSession?.lifecycle_state, "Status:", currentSession?.status);

  return (
    <PlayerGameLoader 
      isLoading={isLoading} 
      errorMessage={errorMessage} 
      currentSession={currentSession} 
    />
  );
}
