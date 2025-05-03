
import React, { useEffect, useState } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";
import { useBingoSync } from "@/hooks/useBingoSync";
import GameTypePlayspace from "./GameTypePlayspace";
import { toast } from "@/hooks/use-toast";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";
import CalledNumbers from "./CalledNumbers";
import { supabase } from "@/integrations/supabase/client";

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
  const [rtCalledNumbers, setRtCalledNumbers] = useState<number[]>([]);
  const [rtLastCalledNumber, setRtLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');
  
  // Generate a unique ID for this component instance for better debug logging
  const instanceId = React.useRef(`player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Set up connection manager for real-time number calls
  React.useEffect(() => {
    if (!currentSession?.id) {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): No session ID, skipping connection setup`);
      return;
    }
    
    logWithTimestamp(`PlayerGameContent (${instanceId.current}): Setting up connection manager for session ${currentSession.id}`);
    
    // Initialize connection
    connectionManager.initialize(currentSession.id)
      .onNumberCalled((number, allNumbers) => {
        logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received real-time number call: ${number}, total numbers: ${allNumbers.length}`);
        setRtLastCalledNumber(number);
        setRtCalledNumbers(allNumbers);
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Show toast notification for new number
        toast({
          title: `Number Called: ${number}`,
          description: `New number has been called`,
          duration: 3000
        });
      })
      .onSessionProgressUpdate((progress) => {
        // This callback is required to avoid the error we were seeing
        logWithTimestamp(`PlayerGameContent (${instanceId.current}): Session progress update received`);
        setIsConnected(true);
        setConnectionStatus('connected');
      });
      
    // Listen for FORCE close events
    const forceCloseChannel = supabase.channel('force-close-listener');
    forceCloseChannel
      .on('broadcast', { event: 'game-force-closed' }, (payload) => {
        if (payload.payload?.sessionId === currentSession.id) {
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Game force closed event received`);
          
          // Show notice to player
          toast({
            title: "Game Has Been Force Closed",
            description: "The caller has force closed this game. The game will reset.",
            variant: "destructive",
            duration: 5000
          });
          
          // Reset local state
          setRtCalledNumbers([]);
          setRtLastCalledNumber(null);
        }
      })
      .on('broadcast', { event: 'game-reset' }, (payload) => {
        if (payload.payload?.sessionId === currentSession.id) {
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Game reset event received`);
          
          // Reset local state
          setRtCalledNumbers([]);
          setRtLastCalledNumber(null);
        }
      })
      .subscribe();
      
    // Set up a heartbeat check to monitor connection status
    const intervalId = setInterval(() => {
      // Check connection state from manager
      const currentState = connectionManager.getConnectionState();
      setConnectionStatus(currentState);
      setIsConnected(currentState === 'connected');
      
      // If we're not connected, try to reconnect
      if (currentState !== 'connected') {
        logWithTimestamp(`PlayerGameContent (${instanceId.current}): Connection heartbeat check - attempting reconnect`);
        connectionManager.reconnect();
      }
    }, 5000); // Every 5 seconds
    
    // Clean up on unmount 
    return () => {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): Cleaning up, clearing heartbeat interval`);
      clearInterval(intervalId);
      // Clean up the force close channel
      supabase.removeChannel(forceCloseChannel);
      // We DON'T call connectionManager.cleanup() here to avoid interrupting other components
      // The parent component should handle that
    };
  }, [currentSession?.id]);

  // Log state for debugging
  useEffect(() => {
    logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Session ID: ${currentSession?.id}, Player: ${playerName || playerCode}, Connection: ${isConnected ? 'connected' : 'disconnected'}`);
    
    if (rtCalledNumbers.length > 0) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Real-time called numbers: ${rtCalledNumbers.length}, last: ${rtLastCalledNumber}`);
    }
  }, [currentSession?.id, playerName, playerCode, rtCalledNumbers, rtLastCalledNumber, isConnected]);

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
          connectionState={connectionStatus}
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
        
        {/* Show called numbers section at the top */}
        <div className="mb-4">
          <CalledNumbers 
            calledNumbers={mergedCalledNumbers} 
            currentNumber={mergedCurrentNumber} 
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
