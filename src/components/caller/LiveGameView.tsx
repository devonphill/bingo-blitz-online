import React, { useState, useEffect, useCallback } from 'react';
import { GameType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallerControls from '@/components/game/CallerControls';
import { useGameData } from '@/hooks/useGameData';
import ClaimVerificationSheet from '../game/ClaimVerificationSheet';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PlayerList from '../game/PlayerList';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { useCallerClaimManagement } from '@/hooks/useCallerClaimManagement';
import ClaimNotifications from './ClaimNotifications';
import { useSessionPatternManager } from '@/hooks/useSessionPatternManager'; // Import our new hook

interface WinPattern {
  id: string;
  name: string;
  gameType: GameType;
  available: boolean;
}

interface LiveGameViewProps {
  gameType: GameType;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  currentWinPattern: string | null;
  onCallNumber: (number: number) => void;
  onRecall: () => void;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  pendingClaims: number;
  onViewClaims: () => void;
  sessionStatus: string;
  onCloseGame: () => void;
  currentGameNumber: number;
  numberOfGames: number;
  gameConfigs: any[];
  sessionId?: string;
}

export function LiveGameView({
  gameType,
  winPatterns,
  selectedPatterns,
  currentWinPattern,
  onCallNumber,
  onRecall,
  lastCalledNumber,
  calledNumbers,
  sessionStatus,
  onCloseGame,
  currentGameNumber,
  numberOfGames,
  gameConfigs,
  sessionId
}: LiveGameViewProps) {
  const [isClaimSheetOpen, setIsClaimSheetOpen] = useState(false);
  const { getCurrentGamePatterns } = useGameData(sessionId);
  const { toast } = useToast();
  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track component mount state
  const isMounted = React.useRef(true);
  
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Use the network context
  const network = useNetwork();
  
  // Use our claim management hook
  const { claims, claimsCount, fetchClaims } = useCallerClaimManagement(sessionId || null);

  // Use our session pattern manager hook with the fixed implementation
  const { updateWinPattern, initializeSessionPattern, updatePatternPrizeInfo } = useSessionPatternManager(sessionId || null);

  // Log when currentWinPattern changes
  React.useEffect(() => {
    logWithTimestamp(`LiveGameView: Current win pattern updated to ${currentWinPattern}`);
    
    // If we have a current win pattern but it has no prize info, update it
    if (currentWinPattern && sessionId) {
      updatePatternPrizeInfo(currentWinPattern);
    }
  }, [currentWinPattern, sessionId, updatePatternPrizeInfo]);
  
  // Set up connection when component mounts
  useEffect(() => {
    console.log('LiveGameView: Setting up network connection');
    
    if (!sessionId) {
      console.log('No session ID provided');
      return;
    }
    
    // Initialize network connection with session ID
    network.connect(sessionId);
    
    // When the component mounts, reconnect to make sure we're in sync
    setTimeout(() => {
      network.connect(sessionId);
      
      // Initialize the session pattern if it doesn't have one yet
      initializeSessionPattern();
    }, 500);
    
  }, [sessionId, network, initializeSessionPattern]);
  
  // Refresh claims periodically
  useEffect(() => {
    if (!sessionId) return;
    
    // Check for claims initially
    fetchClaims();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      if (isMounted.current) {
        fetchClaims();
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, fetchClaims]);
  
  const handleReconnect = () => {
    // Simple reconnect using network context
    if (sessionId) {
      network.connect(sessionId);
      
      toast({
        title: "Reconnecting",
        description: "Refreshing player data...",
        duration: 3000
      });
    }
  };

  const openClaimSheet = () => {
    console.log(`Opening claim verification sheet`);
    // Refresh claims before opening
    if (sessionId) {
      fetchClaims();
    }
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    console.log(`Closing claim verification sheet`);
    setIsClaimSheetOpen(false);
  };
  
  // Direct call number through network context
  const handleCallNumber = (number: number) => {
    console.log(`Calling number: ${number}`);
    
    // Call through network context
    network.callNumber(number, sessionId)
      .then(success => {
        if (!success) {
          console.error("Failed to call number through network context");
        }
      })
      .catch(err => {
        console.error("Error calling number through network context:", err);
      });
    
    // Also call through the traditional method for backward compatibility
    onCallNumber(number);
  };

  // Handle game progression after a valid claim
  const handleGameProgress = useCallback(() => {
    // This function will be called when a valid claim is verified
    if (currentGameNumber < numberOfGames) {
      toast({
        title: "Game Completed",
        description: "Advancing to next game...",
        duration: 5000,
      });
      
      // Add a delay to ensure user sees the success message before progression
      setTimeout(() => {
        if (onCloseGame) {
          onCloseGame();
        }
      }, 3000); // Wait 3 seconds before progressing to next game
    } else {
      toast({
        title: "Final Game Completed",
        description: "All games have been completed!",
        duration: 5000,
      });
    }
  }, [currentGameNumber, numberOfGames, onCloseGame, toast]);

  const handleForceClose = async () => {
    if (!sessionId) return;

    try {
      // Reset the called numbers
      toast({
        title: "Force Closing Game",
        description: "Resetting game state and proceeding to next game...",
        duration: 3000,
      });

      // Broadcast a message to all players about the force close
      if (network) {
        try {
          // Create a channel for broadcasting
          const broadcastChannel = supabase.channel('force-close-broadcast');
          broadcastChannel.send({
            type: 'broadcast', 
            event: 'game-force-closed',
            payload: {
              sessionId: sessionId,
              timestamp: new Date().getTime(),
              message: "The game has been force closed by the caller"
            }
          }).then(() => {
            logWithTimestamp("Force close broadcast sent successfully");
          }).catch(error => {
            console.error("Error broadcasting force close:", error);
          });
        } catch (err) {
          console.error("Error sending broadcast:", err);
        }
      }

      // Call the close game function to advance to the next game
      onCloseGame();

    } catch (error) {
      console.error("Error force closing game:", error);
      toast({
        title: "Error",
        description: "Failed to force close the game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-xl font-bold">Current Game Status</CardTitle>
            <div className="flex items-center gap-2">
              <ClaimNotifications 
                sessionId={sessionId || null}
                onOpenClaimSheet={openClaimSheet}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-100 p-4 rounded-md text-center">
                <div className="text-sm text-gray-500 mb-1">Game</div>
                <div className="text-2xl font-bold">{currentGameNumber} / {numberOfGames}</div>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-md text-center">
                <div className="text-sm text-gray-500 mb-1">Called</div>
                <div className="text-2xl font-bold">{calledNumbers.length}</div>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-md text-center">
                <div className="text-sm text-gray-500 mb-1">Last Called</div>
                <div className="text-2xl font-bold">{lastCalledNumber || '-'}</div>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-md text-center">
                <div className="text-sm text-gray-500 mb-1">Win Pattern</div>
                <div className="text-lg font-bold truncate">{currentWinPattern || 'Not Set'}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Connected players */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-2 flex items-center justify-between">
                  <span>Connected Players</span>
                  <span className="font-medium">{connectedPlayers.length}</span>
                </div>
                <div className="mt-2">
                  <PlayerList 
                    players={connectedPlayers} 
                    isLoading={isLoading} 
                    onReconnect={handleReconnect}
                    sessionId={sessionId}
                    claimsData={claims} // Pass claims data to highlight players with pending claims
                  />
                </div>
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full mt-4 flex items-center justify-center gap-1"
                  onClick={handleReconnect}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Player List
                </Button>
              </div>
              
              {/* Claims panel */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-2">Pending Claims</div>
                <div className="text-lg font-bold">
                  {claimsCount} {claimsCount === 1 ? 'claim' : 'claims'} pending
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {claimsCount > 0 
                    ? 'Review claims by clicking the button below'
                    : 'No claims to review at this time'}
                </div>
                
                <Button 
                  size="sm" 
                  variant={claimsCount > 0 ? "default" : "outline"}
                  className={`w-full mt-4 ${claimsCount > 0 ? 'animate-pulse bg-red-600 hover:bg-red-700' : ''}`}
                  onClick={openClaimSheet}
                >
                  Review Claims
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-6">
        <CallerControls
          onCallNumber={handleCallNumber}
          onEndGame={onCloseGame}
          onGoLive={async () => {}}  // We're already live at this point
          remainingNumbers={remainingNumbers}
          sessionId={sessionId || ''}
          winPatterns={selectedPatterns}
          claimCount={claimsCount}
          openClaimSheet={openClaimSheet}
          gameType={gameType}
          sessionStatus={sessionStatus}
          gameConfigs={gameConfigs}
          onForceClose={handleForceClose}
          disableCallButton={claimsCount > 0} // Disable call button when there are pending claims
        />
      </div>
      
      <ClaimVerificationSheet
        isOpen={isClaimSheetOpen}
        onClose={closeClaimSheet}
        sessionId={sessionId}
        gameNumber={currentGameNumber}
        currentCalledNumbers={calledNumbers}
        gameType={gameType}
        currentNumber={lastCalledNumber}
        currentWinPattern={currentWinPattern}
        onGameProgress={handleGameProgress}
      />
    </div>
  );
}
