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
import { logWithTimestamp } from '@/utils/logUtils';

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
  
  // Use caller WebSocket hub to receive claims
  const callerHub = useCallerHub(sessionId);
  
  // Use state that doesn't change too rapidly
  const [uiConnectionState, setUiConnectionState] = useState('disconnected');
  
  // Add a debounced actual connection state with longer timers for better UX
  const [isActuallyConnected, setIsActuallyConnected] = useState(callerHub.isConnected);
  const disconnectionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Debounce connection state to avoid flashing - heavily favor "connected" state
  useEffect(() => {
    // Immediately update to connected state for good UX
    if (callerHub.connectionState === 'connected' && callerHub.isConnected) {
      // Clear any pending disconnection timer
      if (disconnectionTimerRef.current) {
        clearTimeout(disconnectionTimerRef.current);
        disconnectionTimerRef.current = null;
      }
      setIsActuallyConnected(true);
      setUiConnectionState('connected');
      return;
    }
    
    // For disconnection states, use a longer debounce to prevent flashing
    // Showing a longer "connecting..." state is better UX than flashing between connected/disconnected
    if (callerHub.connectionState === 'connecting') {
      setUiConnectionState('connecting');
      // Don't change isActuallyConnected yet - we want to keep showing as connected until clearly not
      return;
    }
    
    // Only actually report disconnection after several seconds of confirmed disconnection
    // This prevents UI flashing during brief network hiccups
    if (disconnectionTimerRef.current) {
      clearTimeout(disconnectionTimerRef.current);
    }
    
    disconnectionTimerRef.current = setTimeout(() => {
      setIsActuallyConnected(callerHub.isConnected);
      setUiConnectionState(callerHub.connectionState);
      disconnectionTimerRef.current = null;
    }, 5000); // 5 second debounce for stability
    
    // For error states, show those more quickly
    if (callerHub.connectionState === 'error') {
      setUiConnectionState('error');
    }
    
    return () => {
      if (disconnectionTimerRef.current) {
        clearTimeout(disconnectionTimerRef.current);
        disconnectionTimerRef.current = null;
      }
    };
  }, [callerHub.connectionState, callerHub.isConnected]);
  
  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);
  
  // Update claim sheet when new claims arrive
  useEffect(() => {
    if (callerHub.pendingClaims.length > 0) {
      setIsClaimSheetOpen(true);
    }
  }, [callerHub.pendingClaims]);

  // Debug logging for connection status
  useEffect(() => {
    logWithTimestamp(`LiveGameView: connection state: ${callerHub.connectionState}, isConnected: ${callerHub.isConnected}, isActuallyConnected: ${isActuallyConnected}, uiState: ${uiConnectionState}`);
  }, [callerHub.connectionState, callerHub.isConnected, isActuallyConnected, uiConnectionState]);
  
  const openClaimSheet = () => {
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    setIsClaimSheetOpen(false);
  };
  
  const handleReconnect = () => {
    if (callerHub.reconnect) {
      callerHub.reconnect();
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the game server...",
        duration: 3000
      });
    }
  };
  
  // Use the actual connection state for display consistency
  const displayConnectionState = isActuallyConnected ? 'connected' : callerHub.connectionState;

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
                  {callerHub.connectedPlayers.length === 0 && (
                    <p className="text-sm text-gray-500">No players connected yet</p>
                  )}
                  {callerHub.connectedPlayers.map((player, idx) => (
                    <div key={player.playerCode || idx} className="text-sm py-1 border-b border-gray-200 last:border-0">
                      {player.playerName || player.playerCode}
                    </div>
                  ))}
                </div>
              </div>

              {/* WebSocket connection status */}
              <div className="bg-gray-100 p-4 rounded-md">
                <div className="text-sm text-gray-500 mb-1">Connection Status</div>
                <div className={`text-lg font-bold ${isActuallyConnected ? 'text-green-600' : 
                                uiConnectionState === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  {isActuallyConnected ? 'Connected' : 
                   uiConnectionState === 'connecting' ? 'Connecting...' :
                   uiConnectionState === 'error' ? 'Connection Error' : 'Disconnected'}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {callerHub.connectionError || 
                    (isActuallyConnected
                    ? 'WebSocket connection is established and working correctly.'
                    : uiConnectionState === 'connecting'
                    ? 'Establishing WebSocket connection...'
                    : uiConnectionState === 'error'
                    ? 'Error with WebSocket connection. Some features may not work.'
                    : 'WebSocket disconnected. Reconnecting...')}
                </div>
                
                {!isActuallyConnected && (
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
