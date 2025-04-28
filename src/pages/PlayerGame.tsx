
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
  
  // Use stored player code or URL parameter
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

  // Only proceed if we have a player code from the URL or localStorage
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

  // Get session progress from the database for authoritative game state
  const { progress: sessionProgress } = useSessionProgress(currentSession?.id);
  
  // Get real-time updates using our new hook
  const realTimeUpdates = useRealTimeUpdates(currentSession?.id, playerCode);
  
  // Create a wrapper function that matches the expected signature
  const handleClaimBingo = useCallback(() => {
    if (!tickets || tickets.length === 0) {
      console.log("Cannot claim bingo: no tickets available");
      return Promise.resolve(false);
    }
    console.log("Claiming bingo with ticket:", tickets[0]);
    // Call the original handler with the first ticket
    return submitBingoClaim(tickets[0]);
  }, [submitBingoClaim, tickets]);
  
  // Log component state for debugging
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
      realTimeLastCalled: realTimeUpdates.lastCalledNumber
    });
  }, [isLoading, loadingStep, tickets, currentSession, currentGameState, errorMessage, sessionProgress, realTimeUpdates]);
  
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

  // Use realtime data if available, otherwise use data from hooks
  const finalCalledNumbers = realTimeUpdates.calledNumbers.length > 0 ? realTimeUpdates.calledNumbers : 
                            (sessionProgress?.called_numbers || calledItems || []);
  
  const finalLastCalledNumber = realTimeUpdates.lastCalledNumber !== null ? realTimeUpdates.lastCalledNumber :
                              (finalCalledNumbers.length > 0 ? finalCalledNumbers[finalCalledNumbers.length - 1] : lastCalledItem);
  
  // Prioritize real-time updates, then sessionProgress as the source of truth for current win pattern
  const currentWinPattern = realTimeUpdates.currentWinPattern || 
                           sessionProgress?.current_win_pattern || 
                           (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  // Get game numbers from session progress or fallback to game state
  const currentGameNumber = sessionProgress?.current_game_number || 
                           currentGameState?.gameNumber || 
                           1;
  const numberOfGames = sessionProgress?.max_game_number || 
                       currentSession?.numberOfGames || 
                       1;

  // Prepare prize info - from real-time update, session progress, or original props
  let finalWinPrizes = winPrizes;
  if (sessionProgress?.current_win_pattern && sessionProgress?.current_prize) {
    // Add prize from session progress to the win prizes object
    finalWinPrizes = {
      ...finalWinPrizes,
      [sessionProgress.current_win_pattern]: sessionProgress.current_prize
    };
  }

  // If we have real-time prize info, prioritize it
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
