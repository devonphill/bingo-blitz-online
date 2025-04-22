
import React from "react";
import PlayerGameLayout from "./PlayerGameLayout";
import BingoCardGrid from "./BingoCardGrid";

interface PlayerGameContentProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  winPrizes: { [key: string]: string };
  activeWinPatterns: string[];
  onClaimBingo: () => Promise<boolean>;
  errorMessage: string;
  isLoading: boolean;
  isClaiming?: boolean;
  claimStatus?: 'pending' | 'validated' | 'rejected';
  gameType?: string;
}

export default function PlayerGameContent({
  tickets,
  calledNumbers,
  currentNumber,
  currentSession,
  autoMarking,
  setAutoMarking,
  playerCode,
  winPrizes,
  activeWinPatterns,
  onClaimBingo,
  errorMessage,
  isLoading,
  isClaiming,
  claimStatus,
  gameType = '90-ball'
}: PlayerGameContentProps) {
  // Find the current win pattern based on which one is active in the game
  // This should come from the Supabase realtime updates
  const currentWinPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;

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
      currentWinPattern={currentWinPattern}
      onClaimBingo={onClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
      isClaiming={isClaiming}
      claimStatus={claimStatus}
      gameType={gameType}
    >
      <BingoCardGrid
        tickets={tickets}
        calledNumbers={calledNumbers}
        autoMarking={autoMarking}
        activeWinPatterns={activeWinPatterns}
        currentWinPattern={currentWinPattern}
        gameType={gameType}
      />
    </PlayerGameLayout>
  );
}
