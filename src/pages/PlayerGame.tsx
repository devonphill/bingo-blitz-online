
import React from 'react';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';

export default function PlayerGame() {
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
    errorMessage
  } = usePlayerGame();

  // Loader or waiting/error UI
  if (isLoading || errorMessage || !currentSession) {
    return (
      <PlayerGameLoader
        isLoading={isLoading}
        errorMessage={errorMessage}
        currentSession={currentSession}
      />
    );
  }

  return (
    <PlayerGameLayout
      tickets={tickets}
      calledNumbers={calledNumbers}
      currentNumber={currentNumber}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode}
      winPrizes={winPrizes}
      activeWinPatterns={activeWinPatterns}
      onClaimBingo={handleClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
    />
  );
}
