
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
  const connectionId = React.useId();
  
  // Enhanced logging for component lifecycle
  useEffect(() => {
    logWithTimestamp(`[LiveGameView-${connectionId}] Component mounted - cleaning up all connections`);
    cleanupAllConnections();
    
    // Clean up on unmount too
    return () => {
      logWithTimestamp(`[LiveGameView-${connectionId}] Component unmounting - cleaning up all connections`);
      cleanupAllConnections();
    };
  }, [connectionId]);
  
  // Use caller WebSocket hub to receive claims - after cleanup to ensure clean state
  const callerHub = useCallerHub(sessionId);

  // Log detailed connection status changes for debugging
  useEffect(() => {
    logWithTimestamp(`[LiveGameView-${connectionId}] Connection state changed: ${callerHub.connectionState}`);
    logWithTimestamp(`[LiveGameView-${connectionId}] Connected: ${callerHub.isConnected}`);
    logWithTimestamp(`[LiveGameView-${connectionId}] Players: ${callerHub.connectedPlayers.length}`);
    if (callerHub.connectionError) {
      logWithTimestamp(`[LiveGameView-${connectionId}] Connection error: ${callerHub.connectionError}`);
    }
  }, [
    callerHub.connectionState, 
    callerHub.isConnected,
    callerHub.connectedPlayers.length,
    callerHub.connectionError,
    connectionId
  ]);

  // Add a debounced connection state for UI consistency
  const [stableConnectionState, setStableConnectionState] = useState(callerHub.connectionState);
  const [stableIsConnected, setStableIsConnected] = useState(callerHub.isConnected);
  
  // Debounce connection state changes to prevent UI flicker
  useEffect(() => {
    // For connected state, update immediately for good UX
    if (callerHub.isConnected && callerHub.connectionState === 'connected') {
      setStableIsConnected(true);
      setStableConnectionState('connected');
      logWithTimestamp(`[LiveGameView-${connectionId}] Stable connection state updated immediately to connected`);
      return;
    }
    
    // For disconnection, use a short debounce
    logWithTimestamp(`[LiveGameView-${connectionId}] Debouncing connection state change to: ${callerHub.connectionState}`);
    const timer = setTimeout(() => {
      setStableIsConnected(callerHub.isConnected);
      setStableConnectionState(callerHub.connectionState);
      logWithTimestamp(`[LiveGameView-${connectionId}] Stable connection state updated to: ${callerHub.connectionState}`);
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      logWithTimestamp(`[LiveGameView-${connectionId}] Cleared connection state debounce timer`);
    };
  }, [callerHub.isConnected, callerHub.connectionState, connectionId]);

  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);
  
  // Update claim sheet when new claims arrive via WebSocket
  useEffect(() => {
    if (callerHub.pendingClaims.length > 0) {
      logWithTimestamp(`[LiveGameView-${connectionId}] Received ${callerHub.pendingClaims.length} pending claims, opening claim sheet`);
      setIsClaimSheetOpen(true);
    }
  }, [callerHub.pendingClaims, connectionId]);
  
  // Enhanced debug effect for checking player status with more detailed logging
  useEffect(() => {
    logWithTimestamp(`[LiveGameView-${connectionId}] Connection and player status:`);
    logWithTimestamp(`[LiveGameView-${connectionId}] - Connected players: ${callerHub.connectedPlayers.length}`);
    callerHub.connectedPlayers.forEach((player, index) => {
      logWithTimestamp(`[LiveGameView-${connectionId}] - Player ${index+1}: ${player.playerName || player.playerCode}`);
    });
    logWithTimestamp(`[LiveGameView-${connectionId}] - Connection state: ${callerHub.connectionState}`);
    logWithTimestamp(`[LiveGameView-${connectionId}] - isConnected: ${callerHub.isConnected}`);
  }, [callerHub.connectedPlayers, callerHub.connectionState, callerHub.isConnected, connectionId]);
  
  const openClaimSheet = () => {
    logWithTimestamp(`[LiveGameView-${connectionId}] Opening claim verification sheet`);
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    logWithTimestamp(`[LiveGameView-${connectionId}] Closing claim verification sheet`);
    setIsClaimSheetOpen(false);
  };
  
  const handleReconnect = () => {
    if (callerHub.reconnect) {
      logWithTimestamp(`[LiveGameView-${connectionId}] Reconnect button clicked - cleaning up connections`);
      
      // Clean up all connections first to break loops
      cleanupAllConnections();
      
      // Attempt reconnection with enhanced logging
      logWithTimestamp(`[LiveGameView-${connectionId}] Initiating reconnection`);
      callerHub.reconnect();
      
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the game server...",
        duration: 3000
      });
    } else {
      logWithTimestamp(`[LiveGameView-${connectionId}] Reconnect function not available`);
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
              {/* Connected players from WebSocket - use stable connection state */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-2 flex items-center justify-between">
                  <span>Connected Players</span>
                  <span className="font-medium">{callerHub.connectedPlayers.length}</span>
                </div>
                <div className="mt-2">
                  <PlayerList 
                    players={callerHub.connectedPlayers} 
                    isLoading={stableConnectionState === 'connecting'} 
                    connectionState={stableConnectionState}
                  />
                </div>
              </div>

              {/* WebSocket connection status with more detailed display */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-2">Game Server Connection</div>
                <div className={`text-lg font-bold ${stableIsConnected ? 'text-green-600' : 
                              stableConnectionState === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {stableIsConnected ? 'Connected' : 
                   stableConnectionState === 'connecting' ? 'Connecting...' :
                   stableConnectionState === 'error' ? 'Connection Error' : 'Disconnected'}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {callerHub.connectionError || 
                    (stableIsConnected
                    ? 'WebSocket connection is established and working correctly.'
                    : stableConnectionState === 'connecting'
                    ? 'Establishing WebSocket connection...'
                    : 'Attempting to reconnect to game server...')}
                </div>
                
                {!stableIsConnected && (
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
          // Pass the stable connection state for consistency
          connectionState={stableConnectionState}
          isConnected={stableIsConnected}
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
