
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
  sessionId?: string;
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
  numberOfGames = 1,
  sessionId
}: LiveGameViewProps) {
  const numberRange = gameType === 'mainstage' ? 90 : 75;
  
  // Ensure we have a valid session ID
  const effectiveSessionId = sessionId || (gameConfigs.length > 0 && gameConfigs[0].session_id ? gameConfigs[0].session_id : undefined);
  
  // Log the session ID for debugging
  console.log("LiveGameView - effectiveSessionId:", effectiveSessionId);
  
  const { progress, updateProgress } = useSessionProgress(effectiveSessionId);
  
  console.log("LiveGameView - prizes:", prizes);
  console.log("LiveGameView - gameConfigs:", gameConfigs);
  console.log("LiveGameView - sessionStatus:", sessionStatus);
  console.log("LiveGameView - game numbers:", {currentGameNumber, numberOfGames});
  console.log("LiveGameView - selectedPatterns:", selectedPatterns);
  console.log("LiveGameView - session progress:", progress);
  console.log("LiveGameView - sessionId:", effectiveSessionId);
  
  const currentGameConfig = gameConfigs.find(config => config.gameNumber === (progress?.current_game_number || currentGameNumber));
  const activeGameType = currentGameConfig?.gameType || gameType;
  
  let activePatterns: string[] = selectedPatterns;
  if (currentGameConfig && currentGameConfig.patterns) {
    activePatterns = Object.entries(currentGameConfig.patterns)
      .filter(([_, config]) => config.active)
      .map(([patternId]) => patternId);
  }
  
  let actualCurrentWinPattern = currentWinPattern;
  if (progress && progress.current_win_pattern) {
    console.log("Using win pattern from session progress:", progress.current_win_pattern);
    actualCurrentWinPattern = progress.current_win_pattern;
    
    if (!activePatterns.includes(actualCurrentWinPattern)) {
      activePatterns = [actualCurrentWinPattern, ...activePatterns.filter(p => p !== actualCurrentWinPattern)];
    }
  }
  
  let activePrizes: Record<string, PrizeDetails> = prizes;
  if (currentGameConfig && currentGameConfig.patterns) {
    activePrizes = Object.entries(currentGameConfig.patterns).reduce((acc, [patternId, config]) => {
      acc[patternId] = {
        amount: config.prizeAmount,
        description: config.description,
        isNonCash: config.isNonCash
      };
      return acc;
    }, {} as Record<string, PrizeDetails>);
  }
  
  const availablePatterns = activeGameType ? winPatterns.filter(p => p.gameType === activeGameType) : winPatterns;

  const currentPatternPrizeInfo = actualCurrentWinPattern && activePrizes[actualCurrentWinPattern] 
    ? [activePrizes[actualCurrentWinPattern]] : [];

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

  useEffect(() => {
    if (!effectiveSessionId) {
      console.error("No session ID available for updating progress!");
      return;
    }
    
    if (actualCurrentWinPattern) {
      const prizeInfo = activePrizes[actualCurrentWinPattern];
      
      if (prizeInfo) {
        console.log(`Updating session progress with pattern: ${actualCurrentWinPattern}, prize: ${prizeInfo.amount}, description: ${prizeInfo.description}`);
        
        // Only update if we have the updateProgress function (meaning session progress is loaded)
        if (updateProgress) {
          updateProgress({
            current_win_pattern: actualCurrentWinPattern,
            current_prize: prizeInfo.amount.toString(),
            current_prize_description: prizeInfo.description
          }).then(success => {
            if (success) {
              console.log("Successfully updated session progress with pattern and prize info");
            } else {
              console.error("Failed to update session progress with pattern and prize info");
            }
          }).catch(error => {
            console.error("Error updating session progress:", error);
          });
        } else {
          console.warn("updateProgress function not available, can't update session progress");
          
          // Fallback direct update if updateProgress is not available
          supabase
            .from('sessions_progress')
            .update({
              current_win_pattern: actualCurrentWinPattern,
              current_prize: prizeInfo.amount.toString(),
              current_prize_description: prizeInfo.description
            })
            .eq('session_id', effectiveSessionId)
            .then(({ error }) => {
              if (error) {
                console.error("Direct fallback update failed:", error);
              } else {
                console.log("Direct fallback update succeeded");
              }
            });
        }
      } else {
        console.log(`No prize info available for pattern ${actualCurrentWinPattern}`);
      }
    }
  }, [effectiveSessionId, actualCurrentWinPattern, activePrizes, updateProgress]);

  useEffect(() => {
    if (!effectiveSessionId) {
      console.error("No session ID available for broadcasting number!");
      return;
    }
    
    if (lastCalledNumber !== null) {
      const timestamp = Date.now();
      console.log('Broadcasting called number to players with timestamp:', timestamp);
      
      const prizeInfo = actualCurrentWinPattern && activePrizes[actualCurrentWinPattern] 
        ? activePrizes[actualCurrentWinPattern] 
        : null;
      
      const broadcastPayload = {
        sessionId: effectiveSessionId,
        lastCalledNumber,
        calledNumbers,
        activeWinPattern: actualCurrentWinPattern,
        activePatterns,
        prizeInfo,
        timestamp
      };
      
      // Important: Use 'number-broadcast' as the channel name for both send and receive
      const broadcastChannel = supabase.channel('number-broadcast');
      
      broadcastChannel.send({
        type: 'broadcast',
        event: 'number-called',
        payload: broadcastPayload
      }).then(() => {
        console.log('Number broadcast sent successfully!');
        
        // Update session progress with new called numbers
        if (updateProgress) {
          updateProgress({
            called_numbers: calledNumbers,
            current_win_pattern: actualCurrentWinPattern
          }).then((success) => {
            console.log('Database update with called numbers: ', success ? 'succeeded' : 'failed');
          }).catch(error => {
            console.error("Error updating called numbers in database:", error);
          });
        } else {
          // Fallback direct update
          console.warn("Using direct database update as fallback");
          supabase
            .from('sessions_progress')
            .update({
              called_numbers: calledNumbers,
              current_win_pattern: actualCurrentWinPattern
            })
            .eq('session_id', effectiveSessionId)
            .then(({ error }) => {
              if (error) {
                console.error("Direct fallback update for called numbers failed:", error);
              } else {
                console.log("Direct fallback update for called numbers succeeded");
              }
            });
        }
      }).catch(error => {
        console.error('Error broadcasting number:', error);
        setTimeout(() => {
          console.log('Retrying broadcast...');
          broadcastChannel.send({
            type: 'broadcast',
            event: 'number-called',
            payload: broadcastPayload
          }).catch(e => console.error('Retry broadcast failed:', e));
        }, 1000);
      });
    }
  }, [lastCalledNumber, calledNumbers, effectiveSessionId, actualCurrentWinPattern, activePatterns, activePrizes, updateProgress]);

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
          currentSession={{id: effectiveSessionId}}
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
