
import React, { useEffect } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";
import { useBingoSync } from "@/hooks/useBingoSync";
import GameTypePlayspace from "./GameTypePlayspace";
import { toast } from "@/hooks/use-toast";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";

interface PlayerGameContentProps {
  tickets: any[];
  calledNumbers: number[];
  currentNumber: number | null;
  currentSession: any;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
  playerCode: string;
  playerName?: string;
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
  playerName = '',
  winPrizes,
  activeWinPatterns,
  onClaimBingo,
  errorMessage,
  isLoading,
  isClaiming,
  claimStatus,
  gameType = '90-ball'
}: PlayerGameContentProps) {
  // Track local state for real-time number calls
  const [rtCalledNumbers, setRtCalledNumbers] = React.useState<number[]>([]);
  const [rtLastCalledNumber, setRtLastCalledNumber] = React.useState<number | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  
  // Set up connection manager for real-time number calls
  React.useEffect(() => {
    if (currentSession?.id) {
      logWithTimestamp(`PlayerGameContent: Setting up connection manager for session ${currentSession.id}`);
      
      connectionManager.initialize(currentSession.id)
        .onNumberCalled((number, allNumbers) => {
          logWithTimestamp(`PlayerGameContent: Received real-time number call: ${number}`);
          setRtLastCalledNumber(number);
          setRtCalledNumbers(allNumbers);
          setIsConnected(true);
        });
        
      // Set up a heartbeat check to monitor connection status
      const intervalId = setInterval(() => {
        // If we haven't received a number in a while and we're supposed to be connected,
        // try to reconnect the connection manager
        if (isConnected) {
          logWithTimestamp("PlayerGameContent: Connection heartbeat check");
          connectionManager.reconnect();
        }
      }, 30000); // Every 30 seconds
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [currentSession?.id, isConnected]);

  // Log state for debugging
  useEffect(() => {
    logWithTimestamp(`[PlayerGameContent] Session ID: ${currentSession?.id}, Player: ${playerName || playerCode}, Connection: ${isConnected ? 'connected' : 'disconnected'}`);
    logWithTimestamp(`[PlayerGameContent] Original props:`, { 
      calledNumbers: calledNumbers.length || 0, 
      currentNumber,
      isClaiming,
      claimStatus,
      tickets: tickets?.length || 0 
    });
    
    if (rtCalledNumbers.length > 0) {
      logWithTimestamp(`[PlayerGameContent] Real-time called numbers: ${rtCalledNumbers.length}, last: ${rtLastCalledNumber}`);
    }
  }, [currentSession?.id, playerName, playerCode, calledNumbers, currentNumber, isClaiming, claimStatus, tickets, rtCalledNumbers, rtLastCalledNumber, isConnected]);

  const currentWinPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;

  // Merge real-time called numbers with prop values, giving priority to real-time
  const mergedCalledNumbers = rtCalledNumbers.length > 0 
    ? rtCalledNumbers 
    : calledNumbers;

  // Use real-time last called number or fall back to props
  const mergedCurrentNumber = rtLastCalledNumber !== null
    ? rtLastCalledNumber
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

  // Auto-flash notification for new numbers
  React.useEffect(() => {
    if (rtLastCalledNumber !== null) {
      toast({
        title: `Number Called: ${rtLastCalledNumber}`,
        description: `New number has been called`,
        duration: 3000
      });
    }
  }, [rtLastCalledNumber]);

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
          connectionState={isConnected ? 'connected' : 'disconnected'}
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
