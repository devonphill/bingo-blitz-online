import React, { useEffect, useState, useCallback } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import GameTypePlayspace from "./GameTypePlayspace";
import { toast } from "@/hooks/use-toast";
import { connectionManager } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";
import CalledNumbers from "./CalledNumbers";
import CurrentNumberDisplay from "./CurrentNumberDisplay";
import { supabase } from "@/integrations/supabase/client";
import { GoLiveButton } from "@/components/ui/go-live-button";

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
  claimStatus?: 'none' | 'pending' | 'valid' | 'invalid';
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
  claimStatus = 'none',
  gameType = '90-ball'
}: PlayerGameContentProps) {
  // Track local state for real-time number calls
  const [rtCalledNumbers, setRtCalledNumbers] = useState<number[]>([]);
  const [rtLastCalledNumber, setRtLastCalledNumber] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');
  const [activeWinPattern, setActiveWinPattern] = useState<string | null>(null);
  
  // Generate a unique ID for this component instance for better debug logging
  const instanceId = React.useRef(`player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Update active win pattern when it changes from props
  useEffect(() => {
    if (activeWinPatterns && activeWinPatterns.length > 0 && activeWinPatterns[0] !== activeWinPattern) {
      setActiveWinPattern(activeWinPatterns[0]);
    }
  }, [activeWinPatterns, activeWinPattern]);
  
  // Use CONNECTION MANAGER ONLY for all real-time updates
  useEffect(() => {
    if (!currentSession?.id) {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): No session ID, skipping connection setup`, 'info');
      return;
    }
    
    logWithTimestamp(`PlayerGameContent (${instanceId.current}): Setting up connection manager for session ${currentSession.id}`, 'info');
    
    try {
      // Initialize connection without creating new channels internally
      connectionManager.initialize(currentSession.id)
        .onNumberCalled((number, allNumbers) => {
          // Handle null case from reset events
          if (number === null) {
            logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received reset event, clearing numbers`, 'info');
            setRtCalledNumbers([]);
            setRtLastCalledNumber(null);
            return;
          }
          
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received number call via connection manager: ${number}, total numbers: ${allNumbers.length}`, 'info');
          
          // Only update if we have new data
          if (number !== rtLastCalledNumber || allNumbers.length !== rtCalledNumbers.length) {
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
          }
        })
        .onSessionProgressUpdate((progress) => {
          // This callback is required to avoid the error we were seeing
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Session progress update received`, 'info');
          
          // Update connection state
          setIsConnected(true);
          setConnectionStatus('connected');
          
          // Update numbers from progress if available
          if (progress?.called_numbers?.length > 0) {
            const lastNumberIndex = progress.called_numbers.length - 1;
            const lastNumber = progress.called_numbers[lastNumberIndex];
            
            // Only update if we have new data
            if (!rtCalledNumbers.length || 
                rtCalledNumbers.length !== progress.called_numbers.length ||
                rtLastCalledNumber !== lastNumber) {
              logWithTimestamp(`PlayerGameContent (${instanceId.current}): Updating called numbers from progress`, 'info');
              setRtCalledNumbers(progress.called_numbers);
              setRtLastCalledNumber(lastNumber);
            }
          }
          
          // Update win pattern if available
          if (progress?.current_win_pattern) {
            setActiveWinPattern(progress.current_win_pattern);
          }
        });
    } catch (err) {
      console.error("Error setting up connection manager:", err);
    }
      
    // Clean up on unmount - but don't call cleanup() directly to avoid interrupting other components
    return () => {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): Unregistering callbacks from connection manager`, 'info');
    };
  }, [currentSession?.id, rtCalledNumbers.length, rtLastCalledNumber]);
  
  // Log state for debugging
  useEffect(() => {
    logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Session ID: ${currentSession?.id}, Player: ${playerName || playerCode}, Connection: ${isConnected ? 'connected' : 'disconnected'}`, 'info');
    
    if (rtCalledNumbers.length > 0) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Real-time called numbers: ${rtCalledNumbers.length}, last: ${rtLastCalledNumber}`, 'info');
    }
    
    if (activeWinPattern) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Active win pattern: ${activeWinPattern}`, 'info');
    }
  }, [currentSession?.id, playerName, playerCode, rtCalledNumbers, rtLastCalledNumber, isConnected, activeWinPattern]);

  // Use the local state for win pattern if available, otherwise fall back to props
  const currentWinPattern = activeWinPattern || (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

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

  // Function to manually trigger reconnection with improved error handling
  const handleManualReconnect = () => {
    logWithTimestamp(`Manual reconnection requested by user`, 'info');
    
    // Reset connection state
    setConnectionStatus('connecting');
    setIsConnected(false);
    
    // Attempt to re-establish connection
    connectionManager.reconnect();
    
    toast({
      title: "Reconnecting...",
      description: "Attempting to reconnect to the game server",
    });
  };

  // Define a proper mapping function to convert between the different claim status types
  function mapClaimStatus(status: 'none' | 'pending' | 'valid' | 'invalid'): 'pending' | 'rejected' | 'validated' {
    switch(status) {
      case 'none':
        return 'pending';
      case 'valid':
        return 'validated';
      case 'invalid':
        return 'rejected';
      case 'pending':
        return 'pending';
      default:
        return 'pending';
    }
  }

  // For GameTypePlayspace we must use the mapped claim status
  const gameTypePlayspaceClaimStatus = mapClaimStatus(claimStatus);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <GameHeader
          playerName={playerName}
          playerCode={playerCode}
          currentGameNumber={currentSession?.current_game || 1}
          numberOfGames={currentSession?.number_of_games || 1}
          gameType={gameType}
          sessionName={currentSession?.name || "Bingo Game"}
          accessCode={playerCode}
          activeWinPattern={activeWinPattern}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          isConnected={isConnected}
          connectionState={connectionStatus}
          onReconnect={handleManualReconnect}
        />
      </div>
      
      <div className="flex-1 p-4">
        {/* Add prominent current number display */}
        <div className="mb-6 flex justify-center">
          <CurrentNumberDisplay 
            number={mergedCurrentNumber} 
            className="animate-bounce-subtle"
          />
        </div>
        
        {/* Show called numbers section */}
        <div className="mb-4">
          <CalledNumbers 
            calledNumbers={mergedCalledNumbers} 
            currentNumber={mergedCurrentNumber} 
          />
        </div>
        
        <GameTypePlayspace
          gameType={gameType as any}
          tickets={tickets || []}
          calledNumbers={mergedCalledNumbers}
          lastCalledNumber={mergedCurrentNumber}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          handleClaimBingo={handleClaimBingoWithErrorHandling}
          isClaiming={isClaiming}
          claimStatus={gameTypePlayspaceClaimStatus}
        />
      </div>
    </div>
  );
}
