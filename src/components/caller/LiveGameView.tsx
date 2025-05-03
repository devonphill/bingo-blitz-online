import React, { useState, useEffect } from 'react';
import { GameType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallerControls from '@/components/game/CallerControls';
import { useGameData } from '@/hooks/useGameData';
import ClaimVerificationSheet from '../game/ClaimVerificationSheet';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PlayerList from '../game/PlayerList';
import { connectionManager } from '@/utils/connectionManager';

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
  pendingClaims,
  onViewClaims,
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
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Set up connection manager when component mounts
  useEffect(() => {
    console.log('LiveGameView: Setting up connection manager');
    
    if (!sessionId) {
      console.log('No session ID provided');
      return;
    }
    
    // Initialize connection manager with session ID
    connectionManager.initialize(sessionId)
      .onPlayersUpdate((players) => {
        console.log(`Received ${players.length} players update`);
        setConnectedPlayers(players);
        setIsLoading(false);
      })
      .onSessionProgressUpdate((progress) => {
        console.log('Received session progress update');
        // We don't need to do anything with this yet,
        // as the parent component handles progress
      });
    
    // Initial claims fetch
    const fetchClaims = async () => {
      if (sessionId) {
        const fetchedClaims = await connectionManager.fetchClaims();
        setClaims(fetchedClaims || []);
      }
    };
    
    fetchClaims();
    
    // Cleanup on unmount
    return () => {
      console.log('LiveGameView: Cleaning up connection manager');
      connectionManager.cleanup();
    };
  }, [sessionId]);
  
  // Set up claims polling
  useEffect(() => {
    const pollClaims = async () => {
      if (sessionId) {
        const fetchedClaims = await connectionManager.fetchClaims();
        setClaims(fetchedClaims || []);
        
        // Auto-open claims sheet if new claims arrive
        if (fetchedClaims.length > 0 && fetchedClaims.length !== claims.length) {
          setIsClaimSheetOpen(true);
        }
      }
    };
    
    // Poll for claims every 5 seconds
    const interval = setInterval(pollClaims, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, [sessionId, claims.length]);
  
  const handleReconnect = () => {
    // Simple reconnect just re-fetches player data
    setIsLoading(true);
    
    // Force immediate polling
    if (sessionId) {
      connectionManager.initialize(sessionId);
      
      toast({
        title: "Reconnecting",
        description: "Refreshing player data...",
        duration: 3000
      });
    }
  };

  const openClaimSheet = () => {
    console.log(`Opening claim verification sheet`);
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    console.log(`Closing claim verification sheet`);
    setIsClaimSheetOpen(false);
  };
  
  // Direct call number through connection manager
  const handleCallNumber = (number: number) => {
    console.log(`Calling number: ${number}`);
    
    // Call through connection manager
    connectionManager.callNumber(number, sessionId);
    
    // Also call through the traditional method for backward compatibility
    onCallNumber(number);
  };

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
      if (connectionManager) {
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
          <CardHeader>
            <CardTitle className="text-xl font-bold">Current Game Status</CardTitle>
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
                  {claims.length} {claims.length === 1 ? 'claim' : 'claims'} pending
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {claims.length > 0 
                    ? 'Review claims by clicking the button below'
                    : 'No claims to review at this time'}
                </div>
                
                <Button 
                  size="sm" 
                  variant={claims.length > 0 ? "default" : "outline"}
                  className="w-full mt-4"
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
          claimCount={claims.length}
          openClaimSheet={openClaimSheet}
          gameType={gameType}
          sessionStatus={sessionStatus}
          gameConfigs={gameConfigs}
          onForceClose={handleForceClose} // Add the force close handler
        />
      </div>
      
      <ClaimVerificationSheet
        isOpen={isClaimSheetOpen}
        onClose={closeClaimSheet}
        sessionId={sessionId}
        gameNumber={currentGameNumber}
        currentCalledNumbers={calledNumbers}
        gameType={gameType}
        playerName={claims[0]?.playerName}
        currentNumber={lastCalledNumber}
        currentWinPattern={currentWinPattern}
      />
    </div>
  );
}
