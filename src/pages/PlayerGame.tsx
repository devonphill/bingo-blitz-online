
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

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 10:20 - ${message}`);
};

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Initialize playerCode state immediately
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const [loadingPlayerCode, setLoadingPlayerCode] = useState(true);
  
  // Handle player code initialization - only run once on mount
  useEffect(() => {
    const initializePlayerCode = () => {
      console.log("PlayerGame initialized with playerCode from URL:", urlPlayerCode);
      
      if (urlPlayerCode && urlPlayerCode.trim() !== '') {
        console.log("Using player code from URL:", urlPlayerCode);
        localStorage.setItem('playerCode', urlPlayerCode);
        setPlayerCode(urlPlayerCode);
        setLoadingPlayerCode(false);
      } else {
        const storedPlayerCode = localStorage.getItem('playerCode');
        
        if (storedPlayerCode && storedPlayerCode.trim() !== '') {
          console.log("Using stored player code:", storedPlayerCode);
          setPlayerCode(storedPlayerCode);
          // Redirect to have the code in the URL for better bookmarking/sharing
          navigate(`/player/game/${storedPlayerCode}`, { replace: true });
          setLoadingPlayerCode(false);
        } else {
          console.log("No player code found, redirecting to join page");
          localStorage.removeItem('playerCode'); // Clear any invalid codes
          toast({
            title: 'Player Code Missing',
            description: 'Please enter your player code to join the game.',
            variant: 'destructive'
          });
          navigate('/player/join');
        }
      }
    };

    initializePlayerCode();
  }, [urlPlayerCode, navigate, toast]);

  // Always initialize hooks with the same ordering - even if some will not be used
  // This ensures React's hook rules are followed
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

  // Initialize session progress hook - but only use it if we have a valid session
  const { progress: sessionProgress } = useSessionProgress(
    currentSession?.id
  );
  
  // Always initialize bingoSync hook with the same parameters - IMPORTANT: declare before using it
  const bingoSync = useBingoSync(
    currentSession?.id || '', 
    playerCode || '', 
    playerName || ''
  );
  
  // Initialize session state
  const isSessionActive = currentSession?.status === 'active';
  const isGameLive = currentSession?.lifecycle_state === 'live';
  
  // Get game status from bingoSync or sessionProgress
  const gameStatus = bingoSync.gameState.gameStatus || sessionProgress?.game_status || 'pending';
  const isGameActive = gameStatus === 'active';
  
  // Debug logging of game status
  useEffect(() => {
    if (gameStatus) {
      logWithTimestamp(`Current game status from all sources: ${gameStatus}`);
      logWithTimestamp(`Session active: ${isSessionActive}, Game live: ${isGameLive}, Game active: ${isGameActive}`);
    }
  }, [gameStatus, isSessionActive, isGameLive, isGameActive]);
  
  // Always initialize tickets hook with the same parameters, even if it will not be used
  const { tickets } = useTickets(playerCode, currentSession?.id);
  
  // Handle bingo claims
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
  
  // Determine error message with better priority handling
  // For the waiting room, WebSocket errors should not be blockers
  const effectiveErrorMessage = playerCode 
    ? (isSessionActive && isGameActive && isGameLive ? (bingoSync.connectionError || errorMessage || '') : errorMessage || '')
    : "Player code is required. Please join the game again.";
  
  // If game is active and WebSocket isn't, try to reconnect
  useEffect(() => {
    if (isSessionActive && isGameActive && isGameLive && !bingoSync.isConnected && bingoSync.reconnect) {
      console.log("Game is active but not connected to WebSocket, attempting reconnect");
      bingoSync.reconnect();
    }
  }, [isSessionActive, isGameActive, isGameLive, bingoSync]);
  
  // Debug logging
  useEffect(() => {
    console.log("PlayerGame render state:", {
      playerCode,
      isLoading,
      loadingStep,
      hasTickets: tickets && tickets.length > 0,
      hasSession: !!currentSession,
      sessionState: currentSession?.lifecycle_state,
      sessionStatus: currentSession?.status,
      gameState: currentGameState?.status,
      errorMessage: effectiveErrorMessage,
      sessionProgress,
      socketConnectionState: bingoSync.connectionState,
      socketLastCalledNumber: bingoSync.gameState.lastCalledNumber,
      socketCalledNumbers: bingoSync.gameState.calledNumbers.length
    });
  }, [playerCode, isLoading, loadingStep, tickets, currentSession, currentGameState, effectiveErrorMessage, sessionProgress, bingoSync]);

  // Early return during initial loading - no conditional hooks after this point
  if (loadingPlayerCode) {
    return (
      <PlayerGameLoader 
        isLoading={true} 
        errorMessage={null} 
        currentSession={null}
        loadingStep="initializing"
        sessionProgress={null}
      />
    );
  }
  
  // Show error if player code is missing
  if (!playerCode) {
    return (
      <PlayerGameLoader 
        isLoading={false} 
        errorMessage="Player code is required. Please join the game again." 
        currentSession={null}
        loadingStep="error"
        sessionProgress={null}
      />
    );
  }
  
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const hasSession = !!currentSession;
  
  // Waiting room conditions - show loader if:
  // 1. Still loading
  // 2. Critical error that prevents loading (but not WebSocket errors)
  // 3. No session found
  // 4. Session exists but is not active yet (waiting room)
  const shouldShowLoader = 
    isInitialLoading || 
    (!hasSession && !!errorMessage) || 
    !hasSession || 
    (!isGameActive || !isGameLive || !isSessionActive);

  if (shouldShowLoader) {
    logWithTimestamp(`Showing PlayerGameLoader with game status: ${gameStatus}, session active: ${isSessionActive}, game live: ${isGameLive}`);
    
    // Pass WebSocket connection error to loader, but don't make it fatal for waiting room
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={(bingoSync.connectionState === 'error' && currentSession) ? bingoSync.connectionError : errorMessage}
        currentSession={currentSession}
        loadingStep={loadingStep}
        sessionProgress={{
          ...sessionProgress,
          game_status: gameStatus
        }}
      />
    );
  }

  // At this point, we know the game is active and we should have tickets
  if (!hasTickets) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center mb-4 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">No Tickets Available</h2>
          <p className="text-gray-600 mb-4 text-center">
            You don't have any tickets assigned for this game. Please contact the game organizer.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full rounded-md bg-blue-500 hover:bg-blue-600 text-white px-4 py-2"
          >
            Refresh
          </button>
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
        errorMessage={effectiveErrorMessage || ''}
        isLoading={isLoading}
        isClaiming={isSubmittingClaim}
        claimStatus={claimStatus}
        gameType={gameType}
        currentGameNumber={currentGameNumber}
        numberOfGames={numberOfGames}
        connectionState={bingoSync.connectionState}
      >
        <GameTypePlayspace
          gameType={gameType as any}
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
