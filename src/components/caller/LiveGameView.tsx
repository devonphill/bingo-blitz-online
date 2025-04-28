import React, { useState } from 'react';
import { GameType, WinPattern } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallerControls from '@/components/game/CallerControls';
import { useGameData } from '@/hooks/useGameData';
import { ClaimVerificationSheet } from '../game/ClaimVerificationSheet';

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
  
  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);
  
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
              {/* Add more game stats or controls as needed */}
            </div>
          </CardContent>
        </Card>
        
        {/* Add more content as needed */}
      </div>
      
      <div className="space-y-6">
        <CallerControls
          onCallNumber={onCallNumber}
          onEndGame={onCloseGame}
          onGoLive={async () => {}}  // We're already live at this point
          remainingNumbers={remainingNumbers}
          sessionId={sessionId || ''}
          winPatterns={selectedPatterns}
          claimCount={pendingClaims}
          openClaimSheet={openClaimSheet}
          gameType={gameType}
          sessionStatus={sessionStatus}
          gameConfigs={gameConfigs}
        />
        
        {/* Add more controls or information as needed */}
      </div>
      
      <ClaimVerificationSheet
        isOpen={isClaimSheetOpen}
        onClose={closeClaimSheet}
        sessionId={sessionId}
        gameNumber={currentGameNumber}
        currentCalledNumbers={calledNumbers}
        gameType={gameType}
      />
    </div>
  );
}
