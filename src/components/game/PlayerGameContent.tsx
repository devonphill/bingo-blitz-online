
import React from "react";
import GameHeader from "./GameHeader";
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
    <div className="flex flex-col min-h-screen">
      <GameHeader sessionName={currentSession?.name || "Game"} accessCode={playerCode} />
      <div className="flex-grow">
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
      </div>
    </div>
  );
}
