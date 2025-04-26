
import React from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";

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
    <div className="flex flex-col min-h-screen">
      <GameHeader
        sessionName={currentSession?.name || "Bingo Game"}
        accessCode={playerCode}
        activeWinPattern={currentWinPattern}
        autoMarking={autoMarking}
        setAutoMarking={setAutoMarking}
      />
      
      <div className="flex-1 p-4">
        <div className="mb-4">
          <BingoWinProgress
            tickets={tickets}
            calledNumbers={calledNumbers}
            activeWinPatterns={activeWinPatterns}
            currentWinPattern={currentWinPattern}
            handleClaimBingo={onClaimBingo}
            isClaiming={isClaiming}
            claimStatus={claimStatus}
            gameType={gameType}
          />
        </div>
        
        <BingoCardGrid
          tickets={tickets}
          calledNumbers={calledNumbers}
          autoMarking={autoMarking}
          activeWinPatterns={activeWinPatterns}
          currentWinPattern={currentWinPattern}
          gameType={gameType}
        />
      </div>
    </div>
  );
}
