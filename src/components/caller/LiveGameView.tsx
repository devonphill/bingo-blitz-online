
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { WinPatternStatusDisplay } from '@/components/game/WinPatternStatusDisplay';
import { CallControls } from '@/components/caller/CallControls';
import BingoCard from '@/components/caller/BingoCard';
import { GameType, PrizeDetails, GameConfig } from '@/types';

interface LiveGameViewProps {
  gameType: GameType;
  winPatterns: WinPattern[];
  selectedPatterns: string[];
  currentWinPattern: string | null;
  onCallNumber: () => void;
  onRecall: () => void;
  lastCalledNumber: number | null;
  calledNumbers: number[];
  pendingClaims: number;
  onViewClaims: () => void;
  prizes?: { [patternId: string]: PrizeDetails };
  gameConfigs: GameConfig[];
  sessionStatus?: string;
  onCloseGame?: () => void;
  currentGameNumber?: number;
  numberOfGames?: number;
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
  prizes = {},
  gameConfigs = [],
  sessionStatus = 'pending',
  onCloseGame,
  currentGameNumber = 1,
  numberOfGames = 1
}: LiveGameViewProps) {
  const numberRange = gameType === 'mainstage' ? 90 : 75;
  
  console.log("LiveGameView - prizes:", prizes);
  console.log("LiveGameView - gameConfigs:", gameConfigs);
  console.log("LiveGameView - sessionStatus:", sessionStatus);

  // Use the first game's configurations if available
  const currentGameConfig = gameConfigs.length > 0 ? gameConfigs[0] : null;
  const activeGameType = currentGameConfig?.gameType || gameType;
  const activePatterns = currentGameConfig?.selectedPatterns || selectedPatterns;
  const activePrizes = currentGameConfig?.prizes || prizes;
  
  // Get all win patterns for the active game type
  const availablePatterns = activeGameType ? winPatterns.filter(p => p.gameType === activeGameType) : winPatterns;

  return (
    <div className="space-y-6 p-6">
      <WinPatternStatusDisplay 
        patterns={availablePatterns.map(p => ({
          id: p.id,
          name: p.name,
          active: activePatterns.includes(p.id)
        }))}
        currentActive={currentWinPattern}
        gameIsLive={true}
      />
      
      <div className="grid grid-cols-2 gap-6">
        <CallControls
          gameType={activeGameType}
          onCallNumber={onCallNumber}
          onRecall={onRecall}
          lastCalledNumber={lastCalledNumber}
          totalCalls={calledNumbers.length}
          pendingClaims={pendingClaims}
          onViewClaims={onViewClaims}
          sessionStatus={sessionStatus}
          onCloseGame={onCloseGame}
          currentGameNumber={currentGameNumber}
          numberOfGames={numberOfGames}
        />
        
        <BingoCard
          numbers={calledNumbers}
          numberRange={numberRange}
        />
      </div>
    </div>
  );
}
