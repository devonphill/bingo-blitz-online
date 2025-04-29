
import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { useBingoSync } from '@/hooks/useBingoSync';
import { useTickets } from '@/hooks/useTickets';
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
  
  // Check if the game is active
  const isSessionActive = currentSession?.status === 'active';
  const isGameLive = currentSession?.lifecycle_state === 'live';
  const gameStatus = sessionProgress?.game_status || 'pending';
  const isGameActive = gameStatus === 'active';
  
  // Only load tickets if the game is active
  const shouldLoadTickets = currentSession?.id && isSessionActive && isGameLive && isGameActive;
  const { tickets } = useTickets(shouldLoadTickets ? playerCode : null, shouldLoadTickets ? currentSession?.id : undefined);
  
  // Use our WebSocket-based sync hook only when game is active
  const bingoSync = useBingoSync(
    shouldLoadTickets ? currentSession?.id : undefined, 
    shouldLoadTickets ? playerCode : undefined, 
    shouldLoadTickets ? playerName || undefined : undefined
  );
  
  console.log("WebSocket game state:", {
    lastCalledNumber: bingoSync.gameState.lastCalledNumber,
    calledNumbers: bingoSync.gameState.calledNumbers.length, 
    currentWinPattern: bingoSync.gameState.currentWinPattern,
    connectionState: bingoSync.connectionState,
    shouldLoadTickets
  });
  
  const handleClaimBingo = useCallback(() => {
    if (!tickets || tickets.length === 0) {
      console.log("Cannot claim bingo: no tickets available");
      return Promise.resolve(false);
    }
    console.log("Claiming bingo with ticket:", tickets[0]);
    
    // Try to claim bingo through WebSocket first
    if (bingoSync.isConnected) {
      const claimed = bingoSync.claimBingo(tickets[0]);
      if (claimed) {
        return Promise.resolve(true);
      }
    }
    
    // Fall back to regular claim method if WebSocket claim fails
    return submitBingoClaim();
  }, [submitBingoClaim, tickets, bingoSync]);
  
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
      socketConnectionState: bingoSync.connectionState,
      socketLastCalledNumber: bingoSync.gameState.lastCalledNumber,
      socketCalledNumbers: bingoSync.gameState.calledNumbers.length
    });
  }, [isLoading, loadingStep, tickets, currentSession, currentGameState, errorMessage, sessionProgress, bingoSync]);
  
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const hasSession = !!currentSession;
  
  // Show loader if:
  // 1. Still loading
  // 2. Error occurred
  // 3. No session found
  // 4. Session exists but is not active yet (waiting room)
  const shouldShowLoader = 
    (isInitialLoading && loadingStep !== 'completed') || 
    !!errorMessage || 
    !hasSession || 
    (!isGameActive || !isGameLive || !isSessionActive);

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

  // At this point, we know the game is active and we should have tickets
  // If not, something's wrong
  if (!hasTickets) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center mb-4 text-amber-500">
            <Info size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">No Tickets Available</h2>
          <p className="text-gray-600 mb-4 text-center">
            You don't have any tickets assigned for this game. Please contact the game organizer.
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // Use WebSocket data first, then fall back to database data
  const finalCalledNumbers = bingoSync.gameState.calledNumbers.length > 0 
    ? bingoSync.gameState.calledNumbers 
    : (sessionProgress?.called_numbers || calledItems || []);
  
  const finalLastCalledNumber = bingoSync.gameState.lastCalledNumber !== null 
    ? bingoSync.gameState.lastCalledNumber
    : (finalCalledNumbers.length > 0 ? finalCalledNumbers[finalCalledNumbers.length - 1] : lastCalledItem);
  
  const currentWinPattern = bingoSync.gameState.currentWinPattern || 
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

  if (bingoSync.gameState.currentPrize && bingoSync.gameState.currentWinPattern) {
    finalWinPrizes = {
      ...finalWinPrizes,
      [bingoSync.gameState.currentWinPattern]: bingoSync.gameState.currentPrize
    };
  }

  console.log("Rendering main player game interface with:");
  console.log("- Called numbers:", finalCalledNumbers.length);
  console.log("- Last called number:", finalLastCalledNumber);
  console.log("- Current win pattern:", currentWinPattern);
  console.log("- Prize info:", finalWinPrizes);
  console.log("- WebSocket connection state:", bingoSync.connectionState);

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
        connectionState={bingoSync.connectionState}
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
