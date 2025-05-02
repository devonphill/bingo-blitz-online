
import React, { useState, useEffect } from 'react';
import { GameType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallerControls from '@/components/game/CallerControls';
import { useGameData } from '@/hooks/useGameData';
import ClaimVerificationSheet from '../game/ClaimVerificationSheet';
import { useCallerHub } from '@/hooks/useCallerHub';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp, cleanupAllConnections } from '@/utils/logUtils';
import PlayerList from '../game/PlayerList';

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
  
  // CRITICAL FIX: Reset all global connection state on mount
  useEffect(() => {
    // Clean up global connection state to break any connection loops
    logWithTimestamp("LiveGameView mounted - cleaning up all connections");
    cleanupAllConnections();
    
    // Clean up on unmount too
    return () => {
      logWithTimestamp("LiveGameView unmounting - cleaning up all connections");
      cleanupAllConnections();
    };
  }, []);
  
  // Use caller WebSocket hub to receive claims - after cleanup to ensure clean state
  const callerHub = useCallerHub(sessionId);

  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);
  
  // Update claim sheet when new claims arrive via WebSocket
  useEffect(() => {
    if (callerHub.pendingClaims.length > 0) {
      setIsClaimSheetOpen(true);
    }
  }, [callerHub.pendingClaims]);
  
  // Debug effect for checking player status
  useEffect(() => {
    console.log("CallerHub connected players:", callerHub.connectedPlayers);
    console.log("CallerHub connection state:", callerHub.connectionState);
    console.log("CallerHub isConnected:", callerHub.isConnected);
  }, [callerHub.connectedPlayers, callerHub.connectionState, callerHub.isConnected]);
  
  const openClaimSheet = () => {
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    setIsClaimSheetOpen(false);
  };
  
  const handleReconnect = () => {
    if (callerHub.reconnect) {
      // Clean up all connections first to break loops
      cleanupAllConnections();
      
      callerHub.reconnect();
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the game server...",
        duration: 3000
      });
    }
  };

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
              {/* Connected players from WebSocket */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-1">Connected Players</div>
                <div className="text-lg font-bold">{callerHub.connectedPlayers.length}</div>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <PlayerList 
                    players={callerHub.connectedPlayers} 
                    isLoading={callerHub.connectionState === 'connecting'} 
                  />
                </div>
              </div>

              {/* WebSocket connection status with more detailed display */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-1">Game Server Connection</div>
                <div className={`text-lg font-bold ${callerHub.isConnected ? 'text-green-600' : 
                              callerHub.connectionState === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {callerHub.isConnected ? 'Connected' : 
                   callerHub.connectionState === 'connecting' ? 'Connecting...' :
                   callerHub.connectionState === 'error' ? 'Connection Error' : 'Disconnected'}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {callerHub.connectionError || 
                    (callerHub.isConnected
                    ? 'WebSocket connection is established and working correctly.'
                    : callerHub.connectionState === 'connecting'
                    ? 'Establishing WebSocket connection...'
                    : 'Attempting to reconnect to game server...')}
                </div>
                
                {!callerHub.isConnected && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-2 flex items-center justify-center gap-1"
                    onClick={handleReconnect}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reconnect
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-6">
        <CallerControls
          onCallNumber={onCallNumber}
          onEndGame={onCloseGame}
          onGoLive={async () => {}}  // We're already live at this point
          remainingNumbers={remainingNumbers}
          sessionId={sessionId || ''}
          winPatterns={selectedPatterns}
          claimCount={callerHub.pendingClaims.length}
          openClaimSheet={openClaimSheet}
          gameType={gameType}
          sessionStatus={sessionStatus}
          gameConfigs={gameConfigs}
        />
      </div>
      
      <ClaimVerificationSheet
        isOpen={isClaimSheetOpen}
        onClose={closeClaimSheet}
        sessionId={sessionId}
        gameNumber={currentGameNumber}
        currentCalledNumbers={calledNumbers}
        gameType={gameType}
        playerName={callerHub.pendingClaims[0]?.playerName}
        currentNumber={lastCalledNumber}
        currentWinPattern={currentWinPattern}
      />
    </div>
  );
}
