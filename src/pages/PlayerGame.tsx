import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlayerCode, setLoadingPlayerCode] = useState(true);
  
  useEffect(() => {
    console.log("PlayerGame initialized with playerCode from URL:", urlPlayerCode);
    const storedPlayerCode = localStorage.getItem('playerCode');
    
    if (urlPlayerCode) {
      console.log("Storing player code from URL:", urlPlayerCode);
      localStorage.setItem('playerCode', urlPlayerCode);
      setLoadingPlayerCode(false);
    } else if (storedPlayerCode) {
      console.log("Found stored player code, redirecting:", storedPlayerCode);
      navigate(`/player/game/${storedPlayerCode}`, { replace: true });
    } else {
      console.log("No player code found, redirecting to join page");
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/player/join');
    }
  }, [urlPlayerCode, navigate, toast]);

  if (!urlPlayerCode && loadingPlayerCode) {
    return (
      <PlayerGameLoader 
        isLoading={true} 
        errorMessage={null} 
        currentSession={null}
        loadingStep="initializing"
      />
    );
  }
  
  const playerCode = urlPlayerCode || localStorage.getItem('playerCode');
  console.log("Using player code:", playerCode);
  
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
    handleClaimBingo: submitBingoClaim
  } = usePlayerGame(playerCode);

  const { progress: sessionProgress } = useSessionProgress(currentSession?.id);
  
  const realTimeUpdates = useRealTimeUpdates(currentSession?.id, playerCode);
  
  console.log("Real-time updates:", {
    lastCalledNumber: realTimeUpdates.lastCalledNumber,
    calledNumbers: realTimeUpdates.calledNumbers.length, 
    currentWinPattern: realTimeUpdates.currentWinPattern
  });
  
  const handleClaimBingo = useCallback(() => {
    if (!tickets || tickets.length === 0) {
      console.log("Cannot claim bingo: no tickets available");
      return Promise.resolve(false);
    }
    console.log("Claiming bingo with ticket:", tickets[0]);
    return submitBingoClaim(tickets[0]);
  }, [submitBingoClaim, tickets]);
  
  useEffect(() => {
    console.log("PlayerGame render state:", {
      isLoading,
      loadingStep,
      hasTickets: tickets && tickets.length > 0,
      hasSession: !!currentSession,
      sessionState: currentSession?.lifecycle_state,
      sessionStatus: currentSession?.status,
      gameState: currentGameState?.status,
      errorMessage,
      sessionProgress,
      realTimeLastCalled: realTimeUpdates.lastCalledNumber,
      realTimeCalledNumbers: realTimeUpdates.calledNumbers.length
    });
  }, [isLoading, loadingStep, tickets, currentSession, currentGameState, errorMessage, sessionProgress, realTimeUpdates]);
  
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

  if (shouldShowLoader) {
    console.log("Showing PlayerGameLoader with:", {
      isLoading,
      errorMessage,
      currentSession,
      loadingStep
    });
    
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={errorMessage} 
        currentSession={currentSession}
        loadingStep={loadingStep}
      />
    );
  }

  const finalCalledNumbers = realTimeUpdates.calledNumbers.length > 0 
    ? realTimeUpdates.calledNumbers 
    : (sessionProgress?.called_numbers || calledItems || []);
  
  const finalLastCalledNumber = realTimeUpdates.lastCalledNumber !== null 
    ? realTimeUpdates.lastCalledNumber
    : (finalCalledNumbers.length > 0 ? finalCalledNumbers[finalCalledNumbers.length - 1] : lastCalledItem);
  
  const currentWinPattern = realTimeUpdates.currentWinPattern || 
                           sessionProgress?.current_win_pattern || 
                           (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  const currentGameNumber = sessionProgress?.current_game_number || 
                           currentGameState?.gameNumber || 
                           1;
  const numberOfGames = sessionProgress?.max_game_number || 
                       currentSession?.numberOfGames || 
                       1;

  let finalWinPrizes = winPrizes;
  if (sessionProgress?.current_win_pattern && sessionProgress?.current_prize) {
    finalWinPrizes = {
      ...finalWinPrizes,
      [sessionProgress.current_win_pattern]: sessionProgress.current_prize
    };
  }

  if (realTimeUpdates.prizeInfo && currentWinPattern) {
    finalWinPrizes = {
      ...finalWinPrizes,
      [currentWinPattern]: realTimeUpdates.prizeInfo.amount
    };
  }

  console.log("Rendering main player game interface with:");
  console.log("- Called numbers:", finalCalledNumbers.length);
  console.log("- Last called number:", finalLastCalledNumber);
  console.log("- Current win pattern:", currentWinPattern);
  console.log("- Prize info:", finalWinPrizes);

  return (
    <React.Fragment>
      <PlayerGameLayout
        tickets={tickets || []}
        calledNumbers={finalCalledNumbers}
        currentNumber={finalLastCalledNumber}
        currentSession={currentSession}
        autoMarking={autoMarking}
        setAutoMarking={setAutoMarking}
        playerCode={playerCode || ''}
        winPrizes={finalWinPrizes}
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
          calledNumbers={finalCalledNumbers}
          lastCalledNumber={finalLastCalledNumber}
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
