import React from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";
import { useBingoSync } from "@/hooks/useBingoSync";

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
  useBingoSync();

  const currentWinPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;

  React.useEffect(() => {
    if (gameType?.toUpperCase().includes('MAINSTAGE') && !autoMarking) {
      setAutoMarking(true);
    }
  }, [gameType, autoMarking, setAutoMarking]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing game state');
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <GameHeader
          sessionName={currentSession?.name || "Bingo Game"}
          accessCode={playerCode}
          activeWinPattern={currentWinPattern}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
        />
      </div>
      
      <div className="flex-1 p-4">
        <div className="mb-4">
          <BingoWinProgress
            tickets={tickets}
            calledNumbers={calledNumbers}
            activeWinPatterns={[currentWinPattern].filter(Boolean) as string[]}
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
          activeWinPatterns={[currentWinPattern].filter(Boolean) as string[]}
          currentWinPattern={currentWinPattern}
          gameType={gameType}
        />
      </div>
    </div>
  );
}
