import React, { useEffect, useState, useCallback } from "react";
import GameHeader from "./GameHeader";
import BingoCardGrid from "./BingoCardGrid";
import BingoWinProgress from "./BingoWinProgress";
import { useBingoSync } from "@/hooks/useBingoSync";
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
  const [activeWinPattern, setActiveWinPattern] = useState<string | null>(null);
  
  // Generate a unique ID for this component instance for better debug logging
  const instanceId = React.useRef(`player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Update active win pattern when it changes from props
  useEffect(() => {
    if (activeWinPatterns && activeWinPatterns.length > 0 && activeWinPatterns[0] !== activeWinPattern) {
      setActiveWinPattern(activeWinPatterns[0]);
    }
  }, [activeWinPatterns, activeWinPattern]);
  
  // Set up direct subscription to number calls and pattern changes
  useEffect(() => {
    if (!currentSession?.id) {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): No session ID, skipping subscription setup`);
      return;
    }
    
    logWithTimestamp(`PlayerGameContent (${instanceId.current}): Setting up direct subscriptions for session ${currentSession.id}`);
    
    // Create multiple channels for redundancy
    const channels = [
      supabase.channel('number-broadcast'),
      supabase.channel(`number-broadcast-${currentSession.id}`),
      supabase.channel('game-updates')
    ];
    
    // Listen on all channels
    channels.forEach((channel, index) => {
      channel
        .on('broadcast', { event: 'number-called' }, (payload) => {
          if (payload.payload?.sessionId === currentSession.id) {
            const number = payload.payload.lastCalledNumber;
            const allNumbers = payload.payload.calledNumbers || [];
            
            logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received number call: ${number}, total: ${allNumbers.length}`);
            
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
          }
        })
        .on('broadcast', { event: 'pattern-change' }, (payload) => {
          if (payload.payload?.sessionId === currentSession.id) {
            logWithTimestamp(`PlayerGameContent (${instanceId.current}): Pattern change received: ${payload.payload.pattern}`);
            
            // Update active win pattern
            setActiveWinPattern(payload.payload.pattern);
            
            toast({
              title: "Win Pattern Changed",
              description: `The new win pattern is: ${payload.payload.pattern}`,
              duration: 3000
            });
          }
        })
        .subscribe((status) => {
          console.log(`Channel subscription status (channel ${index}):`, status);
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setIsConnected(true);
          }
        });
    });
    
    // Also set up a heartbeat check to monitor connection status and force refresh of data
    const intervalId = setInterval(async () => {
      if (!isConnected) {
        // If we're not connected, try to get the data directly from the database
        try {
          const { data: progressData } = await supabase
            .from('sessions_progress')
            .select('called_numbers, current_win_pattern')
            .eq('session_id', currentSession.id)
            .single();
          
          if (progressData && progressData.called_numbers) {
            // Only update if we have new data
            if (progressData.called_numbers.length > rtCalledNumbers.length) {
              logWithTimestamp(`PlayerGameContent (${instanceId.current}): Updated numbers from database: ${progressData.called_numbers.length} numbers`);
              
              setRtCalledNumbers(progressData.called_numbers);
              
              // Set the last called number as the newest one
              if (progressData.called_numbers.length > 0) {
                const lastNumber = progressData.called_numbers[progressData.called_numbers.length - 1];
                setRtLastCalledNumber(lastNumber);
              }
            }
            
            if (progressData.current_win_pattern) {
              setActiveWinPattern(progressData.current_win_pattern);
            }
          }
        } catch (error) {
          console.error("Error fetching progress data:", error);
        }
      }
    }, 7000); // Every 7 seconds
    
    // Clean up on unmount 
    return () => {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): Cleaning up subscriptions`);
      clearInterval(intervalId);
      
      // Clean up all channels
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [currentSession?.id, rtCalledNumbers.length, rtLastCalledNumber, isConnected]);
  
  // Use the connectionManager as a fallback
  useEffect(() => {
    if (!currentSession?.id) {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): No session ID, skipping connection manager setup`);
      return;
    }
    
    logWithTimestamp(`PlayerGameContent (${instanceId.current}): Setting up connection manager for session ${currentSession.id}`);
    
    // Initialize connection
    connectionManager.initialize(currentSession.id)
      .onNumberCalled((number, allNumbers) => {
        // Handle null case from reset events
        if (number === null) {
          logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received reset event, clearing numbers`);
          setRtCalledNumbers([]);
          setRtLastCalledNumber(null);
          return;
        }
        
        logWithTimestamp(`PlayerGameContent (${instanceId.current}): Received number call via connection manager: ${number}, total numbers: ${allNumbers.length}`);
        
        // Only update if we have new data
        if (number !== rtLastCalledNumber || allNumbers.length !== rtCalledNumbers.length) {
          setRtLastCalledNumber(number);
          setRtCalledNumbers(allNumbers);
          setIsConnected(true);
          setConnectionStatus('connected');
        }
      })
      .onSessionProgressUpdate((progress) => {
        // This callback is required to avoid the error we were seeing
        logWithTimestamp(`PlayerGameContent (${instanceId.current}): Session progress update received`);
        
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
            logWithTimestamp(`PlayerGameContent (${instanceId.current}): Updating called numbers from progress`);
            setRtCalledNumbers(progress.called_numbers);
            setRtLastCalledNumber(lastNumber);
          }
        }
        
        // Update win pattern if available
        if (progress?.current_win_pattern) {
          setActiveWinPattern(progress.current_win_pattern);
        }
      });
      
    // Clean up on unmount
    return () => {
      logWithTimestamp(`PlayerGameContent (${instanceId.current}): Cleaning up connection manager`);
      // We DON'T call connectionManager.cleanup() here to avoid interrupting other components
      // The parent component should handle that
    };
  }, [currentSession?.id, rtCalledNumbers.length, rtLastCalledNumber]);
  
  // Log state for debugging
  useEffect(() => {
    logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Session ID: ${currentSession?.id}, Player: ${playerName || playerCode}, Connection: ${isConnected ? 'connected' : 'disconnected'}`);
    
    if (rtCalledNumbers.length > 0) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Real-time called numbers: ${rtCalledNumbers.length}, last: ${rtLastCalledNumber}`);
    }
    
    if (activeWinPattern) {
      logWithTimestamp(`[PlayerGameContent (${instanceId.current})] Active win pattern: ${activeWinPattern}`);
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

  // Function to manually trigger reconnection
  const handleManualReconnect = () => {
    logWithTimestamp(`Manual reconnection requested by user`);
    
    // Reset connection state
    setConnectionStatus('connecting');
    setIsConnected(false);
    
    // Attempt to re-establish connection through multiple methods
    connectionManager.reconnect();
    
    // Force a direct database query to immediately refresh data
    if (currentSession?.id) {
      supabase
        .from('sessions_progress')
        .select('called_numbers, current_win_pattern')
        .eq('session_id', currentSession.id)
        .single()
        .then(({ data }) => {
          if (data?.called_numbers) {
            setRtCalledNumbers(data.called_numbers);
            if (data.called_numbers.length > 0) {
              setRtLastCalledNumber(data.called_numbers[data.called_numbers.length - 1]);
            }
            
            if (data.current_win_pattern) {
              setActiveWinPattern(data.current_win_pattern);
            }
            
            setConnectionStatus('connected');
            setIsConnected(true);
          }
        })
        .then(undefined, (error) => { // Use this pattern instead of .catch()
          console.error("Error during manual reconnect:", error);
          setConnectionStatus('error');
        });
    }
    
    toast({
      title: "Reconnecting...",
      description: "Attempting to reconnect to the game server",
    });
  };

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
          activeWinPattern={currentWinPattern}
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
        
        {/* Show called numbers section */}
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
