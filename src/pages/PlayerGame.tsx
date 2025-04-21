
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import PlayerGameContent from '@/components/game/PlayerGameContent';

export default function PlayerGame() {
  const [storedPlayerCode, setStoredPlayerCode] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get player code from localStorage
    const playerCode = localStorage.getItem('playerCode');
    
    if (!playerCode) {
      // If no player code is found, redirect to join page
      navigate('/join');
      return;
    }
    
    setStoredPlayerCode(playerCode);
  }, [navigate]);

  const {
    tickets,
    calledNumbers,
    currentNumber,
    currentSession,
    autoMarking,
    setAutoMarking,
    playerCode,
    winPrizes,
    activeWinPatterns,
    handleClaimBingo,
    isLoading,
    errorMessage,
    isClaiming,
    claimStatus
  } = usePlayerGame(storedPlayerCode);

  if (!storedPlayerCode) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <PlayerGameContent
      tickets={tickets}
      calledNumbers={calledNumbers}
      currentNumber={currentNumber}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode || storedPlayerCode}
      winPrizes={winPrizes}
      activeWinPatterns={activeWinPatterns}
      onClaimBingo={handleClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
      isClaiming={isClaiming}
      claimStatus={claimStatus}
    />
  );
}
