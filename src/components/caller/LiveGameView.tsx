
import React, { useEffect } from 'react';
import { WinPattern } from '@/types/winPattern';
import { WinPatternStatusDisplay } from '@/components/game/WinPatternStatusDisplay';
import { MainstageCallControls } from '@/components/caller/MainstageCallControls';
import BingoCard from '@/components/caller/BingoCard';
import { GameType, PrizeDetails, GameConfig } from '@/types';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { supabase } from '@/integrations/supabase/client';

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
  selectedPatterns = [],
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
  const currentGameConfig = gameConfigs.find(config => config.gameNumber === (progress?.current_game_number || currentGameNumber));
  const activeGameType = currentGameConfig?.gameType || gameType;
  
  // Get active patterns from new game config format
  let activePatterns: string[] = selectedPatterns;
  if (currentGameConfig && currentGameConfig.patterns) {
    // Use new format - get active patterns from patterns property
    activePatterns = Object.entries(currentGameConfig.patterns)
      .filter(([_, config]) => config.active)
      .map(([patternId]) => patternId);
  }
  
  // Prioritize win pattern from session progress if available
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
  
  // Get the prizes from the new format
  let activePrizes: Record<string, PrizeDetails> = prizes;
  if (currentGameConfig && currentGameConfig.patterns) {
    // New format
    activePrizes = Object.entries(currentGameConfig.patterns).reduce((acc, [patternId, config]) => {
      acc[patternId] = {
        amount: config.prizeAmount,
        description: config.description,
        isNonCash: config.isNonCash
      };
      return acc;
    }, {} as Record<string, PrizeDetails>);
  }
  
  // Get all win patterns for the active game type
  const availablePatterns = activeGameType ? winPatterns.filter(p => p.gameType === activeGameType) : winPatterns;

  // Get prize info for current win pattern
  const currentPatternPrizeInfo = actualCurrentWinPattern && activePrizes[actualCurrentWinPattern] 
    ? [activePrizes[actualCurrentWinPattern]] : [];

  // Add effect to handle game number changes
  useEffect(() => {
    if (progress && currentGameNumber) {
      console.log(`Checking game numbers - Progress: ${progress.current_game_number}, Current: ${currentGameNumber}`);
      if (progress.current_game_number !== currentGameNumber) {
        console.log('Game number mismatch detected, refreshing page');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    }
  }, [progress, currentGameNumber]);

  // Effect to broadcast number changes to players
  useEffect(() => {
    if (sessionId && lastCalledNumber !== null && calledNumbers.length > 0) {
      const broadcastChannel = supabase.channel('number-broadcast');
      
      console.log('Broadcasting called number to players:', lastCalledNumber);
      
      broadcastChannel.send({
        type: 'broadcast',
        event: 'number-called',
        payload: {
          sessionId,
          lastCalledNumber,
          calledNumbers,
          activeWinPattern: actualCurrentWinPattern,
          activePatterns
        }
      }).then(() => {
        console.log('Number broadcast sent successfully');
      }).catch(error => {
        console.error('Error broadcasting number:', error);
      });
    }
  }, [lastCalledNumber, calledNumbers, sessionId, actualCurrentWinPattern, activePatterns]);

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
          prizesInfo={currentPatternPrizeInfo}
        />
        
        <BingoCard
          numbers={calledNumbers}
          numberRange={numberRange}
        />
      </div>
    </div>
  );
}
