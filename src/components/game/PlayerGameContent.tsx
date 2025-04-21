
import React from "react";
import PlayerGameLayout from "./PlayerGameLayout";

interface PlayerGameContentProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (val: boolean) => void;
  playerCode: string;
  winPrizes: { [key: string]: string };
  activeWinPatterns: string[];
  onClaimBingo: () => void;
  errorMessage: string | null;
  isLoading: boolean;
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
}: PlayerGameContentProps) {
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
      onClaimBingo={onClaimBingo}
      errorMessage={errorMessage}
      isLoading={isLoading}
    />
  );
}
