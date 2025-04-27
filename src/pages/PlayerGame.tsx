
import React, { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import { WIN_PATTERNS } from '@/types/winPattern';
import { supabase } from '@/integrations/supabase/client';
import { Ticket } from '@/types';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use stored player code or URL parameter
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    
    if (urlPlayerCode) {
      localStorage.setItem('playerCode', urlPlayerCode);
    } else if (!storedPlayerCode) {
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/join');
    }
  }, [urlPlayerCode, navigate, toast]);

  const playerCode = urlPlayerCode || localStorage.getItem('playerCode');
  
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
    loadingStep,
    resetClaimStatus,
    claimStatus,
    gameType,
    isSubmittingClaim,
    handleClaimBingo
  } = usePlayerGame(playerCode);

  // Get session progress from the database for authoritative game state
  const { progress: sessionProgress } = useSessionProgress(currentSession?.id);
  
  // Only attempt to render the game if we have all needed data
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const isGameActive = currentGameState?.status === 'active';
  const hasSession = !!currentSession;
  
  // Show loader if needed
  const shouldShowLoader = 
    (isInitialLoading && loadingStep !== 'completed') || 
    !!errorMessage || 
    !hasSession || 
    (!currentGameState && loadingStep !== 'completed') ||
    (!isGameActive && !hasTickets && loadingStep !== 'completed');

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

  // Get game numbers from session progress or fallback to game state
  const currentGameNumber = sessionProgress?.current_game_number || 
                           currentGameState?.gameNumber || 
                           1;
  const numberOfGames = sessionProgress?.max_game_number || 
                       currentSession?.numberOfGames || 
                       1;

  return (
    <React.Fragment>
      <PlayerGameLayout
        tickets={tickets || []}
        calledNumbers={calledItems || []}
        currentNumber={lastCalledItem}
        currentSession={currentSession}
        autoMarking={autoMarking}
        setAutoMarking={setAutoMarking}
        playerCode={playerCode || ''}
        winPrizes={winPrizes}
        activeWinPatterns={currentWinPattern ? [currentWinPattern] : []}
        currentWinPattern={currentWinPattern}
        onClaimBingo={handleClaimBingo}
        errorMessage={errorMessage || ''}
        isLoading={isLoading}
        isClaiming={isSubmittingClaim}
        claimStatus={claimStatus}
        gameType={gameType}
        currentGameNumber={currentGameNumber}
        numberOfGames={numberOfGames}
      >
        <GameTypePlayspace
          gameType={gameType}
          tickets={tickets || []}
          calledNumbers={calledItems || []}
          lastCalledNumber={lastCalledItem}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          handleClaimBingo={handleClaimBingo}
          isClaiming={isSubmittingClaim}
          claimStatus={claimStatus}
        />
      </PlayerGameLayout>
    </React.Fragment>
  );
}
