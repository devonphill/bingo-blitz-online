
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import { WIN_PATTERNS } from '@/types/winPattern';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { PrizeDetails } from '@/types';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    
    if (urlPlayerCode) {
      setPlayerCode(urlPlayerCode);
      localStorage.setItem('playerCode', urlPlayerCode);
    } else if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
    } else {
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/join');
    }
  }, [urlPlayerCode, navigate, toast]);

  const {
    tickets,
    playerName,
    playerId,
    currentSession,
    currentGameState,
    calledItems, 
    lastCalledItem,
    activeWinPatterns,
    winPrizes,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    handleClaimBingo,
    isClaiming,
    claimStatus,
    gameType,
    loadingStep,
    resetClaimStatus,
  } = usePlayerGame(playerCode);

  // Get session progress from the database for authoritative game state
  const { progress: sessionProgress } = useSessionProgress(currentSession?.id);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
  const forceRefresh = useCallback(() => {
    console.log('Forcing refresh of PlayerGame component');
    setForceRefreshKey(prevKey => prevKey + 1);
    setAutoMarking(prev => !prev);
    setTimeout(() => setAutoMarking(prev => !prev), 100);
  }, [setAutoMarking]);

  // Synchronize with session progress when it changes
  useEffect(() => {
    if (sessionProgress && currentSession) {
      console.log(`Session progress synced: Game ${sessionProgress.current_game_number}/${sessionProgress.max_game_number}, Pattern: ${sessionProgress.current_win_pattern}`);
      
      // Check if the win pattern from session progress differs from what we have in state
      const currentPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;
      if (sessionProgress.current_win_pattern && 
          currentPattern !== sessionProgress.current_win_pattern &&
          currentPattern !== `MAINSTAGE_${sessionProgress.current_win_pattern}`) {
        
        console.log(`Win pattern mismatch - Progress shows ${sessionProgress.current_win_pattern} but state has ${currentPattern}`);
        forceRefresh();
        
        const patternName = getWinPatternName(sessionProgress.current_win_pattern);
        toast({
          title: "Win Pattern Changed",
          description: `Now playing for: ${patternName}`,
        });
      }
      
      // Check if the game number from session progress differs from what we have in state
      const currentGameNumber = currentGameState?.gameNumber || 1;
      if (sessionProgress.current_game_number !== currentGameNumber) {
        console.log(`Game number mismatch - Progress shows ${sessionProgress.current_game_number} but state has ${currentGameNumber}`);
        forceRefresh();
        
        toast({
          title: "Game Changed",
          description: `Now playing game ${sessionProgress.current_game_number} of ${sessionProgress.max_game_number}`,
        });
      }
    }
  }, [sessionProgress, activeWinPatterns, currentGameState, currentSession, toast, forceRefresh]);

  useEffect(() => {
    if (claimStatus === 'validated' || claimStatus === 'rejected') {
      const timer = setTimeout(() => {
        console.log(`Auto-resetting claim status from ${claimStatus} state after timeout`);
        resetClaimStatus();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [claimStatus, resetClaimStatus]);

  const getWinPatternName = (patternId: string) => {
    if (!patternId) return 'Unknown';
    
    const displayPatternId = patternId.replace('MAINSTAGE_', '');
    
    const allPatterns = gameType ? WIN_PATTERNS[gameType] : [];
    const pattern = allPatterns.find(p => p.id === displayPatternId);
    
    if (displayPatternId === 'oneLine') return 'One Line';
    if (displayPatternId === 'twoLines') return 'Two Lines';
    if (displayPatternId === 'fullHouse') return 'Full House';
    
    return pattern ? pattern.name : patternId;
  };

  // Set up broadcast listener for claim updates and game progression
  useEffect(() => {
    if (!playerCode || !currentSession?.id) return;
    
    console.log("Setting up broadcast channel for player claim updates");
    
    const broadcastChannel = supabase.channel('player-game-updates')
      .on('broadcast', { event: 'claim-update' }, (payload) => {
        console.log("Received claim update broadcast:", payload);
        if (payload.payload && payload.payload.sessionId === currentSession.id) {
          console.log("Refreshing game state due to claim update");
          
          if ((payload.payload.result === 'valid' || payload.payload.result === 'false') && isClaiming) {
            console.log(`Resetting claim status due to ${payload.payload.result} broadcast result`);
            resetClaimStatus();
            
            if (payload.payload.result === 'valid') {
              toast({
                title: "Claim Verified",
                description: "Your bingo claim has been verified!",
                variant: "default"
              });
            } else if (payload.payload.result === 'false') {
              toast({
                title: "Claim Rejected", 
                description: "Your claim was not valid. Please check your card.",
                variant: "destructive"
              });
            }
          }
          
          if (payload.payload.patternChange === true) {
            console.log("Pattern change detected in broadcast, forcing refresh");
            forceRefresh();
            
            if (payload.payload.nextPattern) {
              const patternName = getWinPatternName(payload.payload.nextPattern);
              toast({
                title: "Win Pattern Changed",
                description: `Now playing for: ${patternName}`,
              });
            }
          }
        }
      })
      .subscribe();
      
    // Listen for game progression broadcasts
    const progressionChannel = supabase.channel('game-progression-listener')
      .on('broadcast', { event: 'game-progression' }, (payload) => {
        console.log("Received game progression broadcast in PlayerGame:", payload);
        if (payload.payload && payload.payload.sessionId === currentSession.id) {
          console.log("Forcing refresh due to game progression");
          
          resetClaimStatus();
          
          // Show different messages based on what changed
          if (payload.payload.nextPattern) {
            const patternName = getWinPatternName(payload.payload.nextPattern);
            toast({
              title: "Pattern Changed",
              description: `Now playing for: ${patternName}`,
            });
          } else if (payload.payload.newGame && payload.payload.newGame !== payload.payload.previousGame) {
            toast({
              title: "Game Changed",
              description: `Moving to game ${payload.payload.newGame}`,
            });
          }
          
          // Force refresh to re-fetch all game state
          forceRefresh();
          
          // Add a delayed refresh to make sure we get the latest state
          setTimeout(() => forceRefresh(), 500);
        }
      })
      .subscribe();
      
    return () => {
      console.log("Cleaning up broadcast channels");
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(progressionChannel);
    };
  }, [playerCode, currentSession?.id, isClaiming, resetClaimStatus, toast, forceRefresh]);

  // Add direct database subscription for session updates
  useEffect(() => {
    if (!currentSession?.id) return;
    
    console.log("Setting up direct realtime subscription for game session");
    
    const channel = supabase
      .channel(`player-game-session-${currentSession.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${currentSession.id}`
        },
        (payload) => {
          console.log("Received direct database update:", payload);
          
          if (payload.new && JSON.stringify(payload.new) !== JSON.stringify(payload.old)) {
            console.log("Database change detected, refreshing game state");
            forceRefresh();
          }
        }
      )
      .subscribe();
      
    return () => {
      console.log("Removing database subscription");
      supabase.removeChannel(channel);
    };
  }, [currentSession?.id, forceRefresh]);

  // Loading and initialization logic
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const isGameActive = currentGameState?.status === 'active';
  const hasSession = !!currentSession;
  
  const shouldShowLoader = 
    (isInitialLoading && loadingStep !== 'completed') || 
    !!errorMessage || 
    !hasSession || 
    (!currentGameState && loadingStep !== 'completed') ||
    (!isGameActive && !hasTickets && loadingStep !== 'completed');

  useEffect(() => {
    if (hasSession && hasTickets && isGameActive && loadingStep === 'completed') {
      console.log('Game fully loaded, stable state reached');
    }
  }, [hasSession, hasTickets, isGameActive, loadingStep]);

  // Debug logging
  useEffect(() => {
    console.log('Player Game Render State:', {
      isLoading,
      loadingStep,
      hasSession,
      isGameActive: currentGameState?.status,
      hasTickets: tickets?.length,
      shouldShowLoader,
      isClaiming,
      claimStatus,
      activeWinPatterns,
      sessionProgress: sessionProgress ? 
        `Game ${sessionProgress.current_game_number}/${sessionProgress.max_game_number}, Pattern: ${sessionProgress.current_win_pattern}` : 
        'Not loaded'
    });
    
    if (sessionProgress?.current_win_pattern && activeWinPatterns.length > 0) {
      console.log(`Pattern comparison - Progress: ${sessionProgress.current_win_pattern}, State: ${activeWinPatterns[0]}`);
      
      // Also log if there's a mismatch
      const progressPattern = sessionProgress.current_win_pattern;
      const statePattern = activeWinPatterns[0];
      
      if (progressPattern !== statePattern && `MAINSTAGE_${progressPattern}` !== statePattern) {
        console.warn(`Pattern MISMATCH detected! DB: ${progressPattern}, State: ${statePattern}`);
      }
    }
  }, [isLoading, loadingStep, currentSession, currentGameState, tickets, shouldShowLoader, 
      isClaiming, claimStatus, activeWinPatterns, sessionProgress]);

  // Show loader if needed
  if (shouldShowLoader) {
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={errorMessage} 
        currentSession={currentSession}
        loadingStep={loadingStep}
      />
    );
  }

  // Prioritize sessionProgress as the source of truth for current win pattern
  const currentWinPattern = sessionProgress?.current_win_pattern || 
                           (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  // Parse prizes
  const simplifiedPrizes: { [key: string]: string } = {};
  if (winPrizes) {
    Object.entries(winPrizes).forEach(([key, prize]) => {
      if (typeof prize === 'string') {
        simplifiedPrizes[key] = prize;
      } else if (prize && typeof prize === 'object') {
        const prizeDetail = prize as PrizeDetails;
        simplifiedPrizes[key] = prizeDetail.amount || prizeDetail.description || 'Prize';
      }
    });
  }

  // Get game numbers from session progress or fallback to game state
  const currentGameNumber = sessionProgress?.current_game_number || 
                           currentGameState?.gameNumber || 
                           1;
  const numberOfGames = sessionProgress?.max_game_number || 
                       currentSession?.numberOfGames || 
                       1;

  return (
    <React.Fragment key={`player-game-${forceRefreshKey}`}>
      <PlayerGameLayout
        tickets={tickets || []}
        calledNumbers={calledItems || []}
        currentNumber={lastCalledItem}
        currentSession={currentSession}
        autoMarking={autoMarking}
        setAutoMarking={setAutoMarking}
        playerCode={playerCode || ''}
        winPrizes={simplifiedPrizes}
        activeWinPatterns={currentWinPattern ? [currentWinPattern] : []}
        currentWinPattern={currentWinPattern}
        onClaimBingo={handleClaimBingo}
        errorMessage={errorMessage || ''}
        isLoading={isLoading}
        isClaiming={isClaiming}
        claimStatus={claimStatus}
        gameType={gameType || 'mainstage'}
        currentGameNumber={currentGameNumber}
        numberOfGames={numberOfGames}
      >
        <GameTypePlayspace
          gameType={gameType || "mainstage"}
          tickets={tickets || []}
          calledNumbers={calledItems || []}
          lastCalledNumber={lastCalledItem}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          handleClaimBingo={handleClaimBingo}
          isClaiming={isClaiming}
          claimStatus={claimStatus}
        />
      </PlayerGameLayout>
    </React.Fragment>
  );
}
