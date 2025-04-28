
import React, { useEffect } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";
import { useBingoSync } from "@/hooks/useBingoSync";
import GameTypePlayspace from "./GameTypePlayspace";
import { toast } from "@/hooks/use-toast";

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
  // Use our enhanced real-time sync hook with the session ID
  const { gameState, isConnected, connectionState } = useBingoSync(currentSession?.id);

  // Log state for debugging
  useEffect(() => {
    console.log(`[PlayerGameContent] Session ID: ${currentSession?.id}, Connection: ${connectionState}`);
    console.log(`[PlayerGameContent] gameState:`, gameState);
    console.log(`[PlayerGameContent] Original props:`, { 
      calledNumbers, 
      currentNumber,
      isClaiming,
      claimStatus,
      tickets: tickets?.length || 0 
    });
  }, [currentSession?.id, connectionState, gameState, calledNumbers, currentNumber, isClaiming, claimStatus, tickets]);

  const currentWinPattern = 
    // First check real-time updates
    gameState.currentWinPattern || 
    // Fall back to prop values
    (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  // Merge real-time called numbers with prop values, giving priority to real-time
  const mergedCalledNumbers = gameState.calledNumbers.length > 0 
    ? gameState.calledNumbers 
    : calledNumbers;

  // Use real-time last called number or fall back to props
  const mergedCurrentNumber = gameState.lastCalledNumber !== null
    ? gameState.lastCalledNumber
    : currentNumber;

  // Force auto-marking for Mainstage games
  React.useEffect(() => {
    if (gameType?.toUpperCase().includes('MAINSTAGE') && !autoMarking) {
      setAutoMarking(true);
    }
  }, [gameType, autoMarking, setAutoMarking]);

  // Handle bingo claim with better error handling
  const handleClaimBingoWithErrorHandling = async () => {
    if (!onClaimBingo) {
      console.error("No claim handler available");
      toast({
        title: "Claim Not Available",
        description: "Cannot claim bingo at this time.",
        variant: "destructive"
      });
      return false;
    }

    try {
      console.log("Attempting to claim bingo...");
      const result = await onClaimBingo();
      console.log("Claim result:", result);
      return result;
    } catch (error) {
      console.error("Error claiming bingo:", error);
      toast({
        title: "Claim Error",
        description: "There was a problem submitting your claim.",
        variant: "destructive"
      });
      return false;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <GameHeader
          sessionName={currentSession?.name || "Bingo Game"}
          accessCode={playerCode}
          activeWinPattern={currentWinPattern}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          isConnected={isConnected}
          connectionState={connectionState}
        />
      </div>
      
      <div className="flex-1 p-4">
        <div className="mb-4">
          <BingoWinProgress
            tickets={tickets}
            calledNumbers={mergedCalledNumbers}
            activeWinPatterns={[currentWinPattern].filter(Boolean) as string[]}
            currentWinPattern={currentWinPattern}
            handleClaimBingo={handleClaimBingoWithErrorHandling}
            isClaiming={isClaiming}
            claimStatus={claimStatus}
            gameType={gameType}
          />
        </div>
        
        <GameTypePlayspace
          gameType={gameType as any}
          tickets={tickets}
          calledNumbers={mergedCalledNumbers}
          lastCalledNumber={mergedCurrentNumber}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          handleClaimBingo={handleClaimBingoWithErrorHandling}
          isClaiming={isClaiming}
          claimStatus={claimStatus}
        />
      </div>
    </div>
  );
}
