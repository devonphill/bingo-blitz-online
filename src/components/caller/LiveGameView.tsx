
import React, { useEffect } from 'react';
import { WinPattern } from '@/types/winPattern';
import { WinPatternStatusDisplay } from '@/components/game/WinPatternStatusDisplay';
import { MainstageCallControls } from '@/components/caller/MainstageCallControls';
import BingoCard from '@/components/caller/BingoCard';
import { GameType, PrizeDetails, GameConfig } from '@/types';
import { useSessionProgress } from '@/hooks/useSessionProgress';

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
  // Get the session_id safely from the gameConfigs array
  const sessionId = gameConfigs.length > 0 && gameConfigs[0].session_id ? gameConfigs[0].session_id : undefined;
  const { progress } = useSessionProgress(sessionId);
  
  console.log("LiveGameView - prizes:", prizes);
  console.log("LiveGameView - gameConfigs:", gameConfigs);
  console.log("LiveGameView - sessionStatus:", sessionStatus);
  console.log("LiveGameView - game numbers:", {currentGameNumber, numberOfGames});
  console.log("LiveGameView - selectedPatterns:", selectedPatterns);
  console.log("LiveGameView - session progress:", progress);
  console.log("LiveGameView - sessionId:", sessionId);
  
  // Use the first game's configurations if available
  const currentGameConfig = gameConfigs.length > 0 ? 
    gameConfigs.find(config => config.gameNumber === currentGameNumber) || gameConfigs[0] 
    : null;
    
  const activeGameType = currentGameConfig?.gameType || gameType;
  
  // Prioritize win pattern from session progress if available
  let activePatterns = currentGameConfig?.selectedPatterns || selectedPatterns;
  let actualCurrentWinPattern = currentWinPattern;
  
  if (progress && progress.current_win_pattern) {
    // If we have progress data, use that pattern as the active one
    console.log("Using win pattern from session progress:", progress.current_win_pattern);
    actualCurrentWinPattern = progress.current_win_pattern;
    
    // If the pattern from progress isn't in activePatterns, add it
    if (!activePatterns.includes(actualCurrentWinPattern)) {
      activePatterns = [actualCurrentWinPattern, ...activePatterns.filter(p => p !== actualCurrentWinPattern)];
    }
  }
  
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
        currentActive={actualCurrentWinPattern}
        gameIsLive={true}
      />
      
      <div className="grid grid-cols-2 gap-6">
        <MainstageCallControls
          onCallNumber={onCallNumber}
          lastCalledNumber={lastCalledNumber}
          totalCalls={calledNumbers.length}
          pendingClaims={pendingClaims}
          onViewClaims={onViewClaims}
          sessionStatus={sessionStatus}
          onCloseGame={onCloseGame}
          currentGameNumber={progress?.current_game_number || currentGameNumber}
          numberOfGames={progress?.max_game_number || numberOfGames}
          activeWinPatterns={activePatterns}
          currentSession={{id: sessionId}}
        />
        
        <BingoCard
          numbers={calledNumbers}
          numberRange={numberRange}
        />
      </div>
    </div>
  );
}
