
import React from 'react';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import PlayerGameContent from '@/components/game/PlayerGameContent';

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
    errorMessage,
    isClaiming,
    claimStatus
  } = usePlayerGame();

  return (
    <PlayerGameContent
      tickets={tickets}
      calledNumbers={calledNumbers}
      currentNumber={currentNumber}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode || ''}
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
