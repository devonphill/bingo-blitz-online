import React, { useEffect, useState, useCallback, useMemo } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import GameTypePlayspace from "./GameTypePlayspace";
import { toast } from "@/hooks/use-toast";
import { connectionManager, ConnectionState } from "@/utils/connectionManager";
import { logWithTimestamp } from "@/utils/logUtils";
import CalledNumbers from "./CalledNumbers";
import CurrentNumberDisplay from "./CurrentNumberDisplay";
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

// Define a mapping type for GameTypePlayspace claim status
type GameTypePlayspaceClaimStatus = 'pending' | 'rejected' | 'validated';

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
  const [activeWinPattern, setActiveWinPattern] = useState<string | null>(null);
  
  // Generate a unique ID for this component instance for better debug logging
  const instanceId = React.useRef(`player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Update active win pattern when it changes from props
  useEffect(() => {
    if (activeWinPatterns && activeWinPatterns.length > 0 && activeWinPatterns[0] !== activeWinPattern) {
      setActiveWinPattern(activeWinPatterns[0]);
    }
  }, [activeWinPatterns, activeWinPattern]);
  
  // Custom, debounced connection status check to avoid UI flashing
  const debouncedSetConnectionStatus = useCallback((status: ConnectionState) => {
    // Only update if there's a significant change to prevent UI flashing 
    setConnectionStatus(prevStatus => {
      // Don't rapidly toggle between connecting/disconnected
      if (status === 'connecting' && prevStatus === 'disconnected') {
        return prevStatus;
      }
      
      // Always show connected status immediately
      if (status === 'connected') {
        return status;
      }
      
      // Otherwise update normally
      return status;
    });
  }, []);
  
  // Setup single connection handling
  useEffect(() => {
    if (!currentSession?.id) {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): No session ID, skipping connection setup`, 'info');
      return;
    }
    
    logWithTimestamp(`PlayerGameContent (${instanceId.current}): Setting up connection manager for session ${currentSession.id}`, 'info');
    
    try {
      // Initialize connection once
      const session = connectionManager
        .initialize(currentSession.id)
        .onNumberCalled((number, allNumbers) => {
          if (number === null) {
            // Handle reset event
            logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received reset event, clearing numbers`, 'info');
            setRtCalledNumbers([]);
            setRtLastCalledNumber(null);
            return;
          }
          
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received number call: ${number}, total: ${allNumbers.length}`, 'info');
          
          // Only update state if we have new data to prevent unnecessary renders
          if (number !== rtLastCalledNumber || 
              !rtCalledNumbers.length || 
              allNumbers.length !== rtCalledNumbers.length) {
            setRtLastCalledNumber(number);
            setRtCalledNumbers(allNumbers);
            
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
        })
        .onConnectionStatusChange((isConnected) => {
          const status: ConnectionState = isConnected ? 'connected' : 'disconnected'; 
          debouncedSetConnectionStatus(status);
        })
        .onError((error) => {
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Connection error: ${error}`, 'error');
          debouncedSetConnectionStatus('error');
        });
      
    } catch (err) {
      console.error("Error setting up connection manager:", err);
      debouncedSetConnectionStatus('error');
    }
    
    // Check connection status periodically but don't reconnect here
    const checkInterval = setInterval(() => {
      const currentStatus = connectionManager.getConnectionState();
      debouncedSetConnectionStatus(currentStatus);
    }, 5000);
    
    // Clean up on unmount
    return () => {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): Cleaning up connection check interval`, 'info');
      clearInterval(checkInterval);
    };
  }, [currentSession?.id, debouncedSetConnectionStatus]);
  
  // Log state for debugging but with reduced frequency using dependencies
  useEffect(() => {
    logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Connection: ${connectionStatus}, Session: ${currentSession?.id}`, 'info');
    
    if (rtCalledNumbers.length > 0) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Called numbers: ${rtCalledNumbers.length}, last: ${rtLastCalledNumber}`, 'info');
    }
  }, [connectionStatus, currentSession?.id, rtLastCalledNumber]);

  // Use the local state for win pattern if available, otherwise fall back to props
  const currentWinPattern = activeWinPattern || (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  // Merge real-time called numbers with prop values, giving priority to real-time
  const mergedCalledNumbers = useMemo(() => {
    return rtCalledNumbers.length > 0 ? rtCalledNumbers : calledNumbers;
  }, [rtCalledNumbers, calledNumbers]);

  // Use real-time last called number or fall back to props
  const mergedCurrentNumber = useMemo(() => {
    return rtLastCalledNumber !== null ? rtLastCalledNumber : currentNumber;
  }, [rtLastCalledNumber, currentNumber]);

  // Force auto-marking for Mainstage games
  React.useEffect(() => {
    if (gameType?.toUpperCase().includes('MAINSTAGE') && !autoMarking) {
      setAutoMarking(true);
    }
  }, [gameType, autoMarking, setAutoMarking]);

  // Handle bingo claim with error handling
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
  const handleManualReconnect = useCallback(() => {
    logWithTimestamp(`Manual reconnection requested by user`, 'info');
    
    // Reset connection state
    setConnectionStatus('connecting');
    
    // Attempt to re-establish connection
    connectionManager.reconnect();
    
    toast({
      title: "Reconnecting...",
      description: "Attempting to reconnect to the game server",
    });
  }, []);

  // Define a proper mapping function to convert between the different claim status types
  const mapClaimStatus = useCallback((status: 'none' | 'pending' | 'valid' | 'invalid'): GameTypePlayspaceClaimStatus => {
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
  }, []);

  // For GameTypePlayspace we must use the mapped claim status
  const gameTypePlayspaceClaimStatus = useMemo(() => 
    mapClaimStatus(claimStatus), 
  [claimStatus, mapClaimStatus]);

  // Determine if we're connected based on connection status
  const isConnected = connectionStatus === 'connected';

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
