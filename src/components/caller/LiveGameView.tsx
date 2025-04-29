
import React, { useState, useEffect } from 'react';
import { GameType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallerControls from '@/components/game/CallerControls';
import { useGameData } from '@/hooks/useGameData';
import ClaimVerificationSheet from '../game/ClaimVerificationSheet';
import { useCallerHub } from '@/hooks/useCallerHub';

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
  
  // Use caller WebSocket hub to receive claims
  const callerHub = useCallerHub(sessionId);
  
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
  
  const openClaimSheet = () => {
    setIsClaimSheetOpen(true);
  };
  
  const closeClaimSheet = () => {
    setIsClaimSheetOpen(false);
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
                <div className={`text-lg font-bold ${callerHub.connectionState === 'connected' ? 'text-green-600' : 'text-amber-600'}`}>
                  {callerHub.connectionState === 'connected' ? 'Connected' : callerHub.connectionState}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {callerHub.connectionState === 'connected'
                    ? 'WebSocket connection is established and working correctly.'
                    : callerHub.connectionState === 'connecting'
                    ? 'Establishing WebSocket connection...'
                    : callerHub.connectionState === 'error'
                    ? 'Error with WebSocket connection. Some features may not work.'
                    : 'WebSocket disconnected. Reconnecting...'}
                </div>
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
