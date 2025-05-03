import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { useTickets } from '@/hooks/useTickets';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import { connectionManager } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Initialize connection state
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');
  
  // Initialize when component mounts
  useEffect(() => {
    logWithTimestamp("PlayerGame mounted - initializing connection manager");
    
    // We'll initialize the actual session connection once we have the session ID
    // For now, just make sure we're in a clean state
    connectionManager.cleanup();
    
    return () => {
      logWithTimestamp("PlayerGame unmounting - cleaning up connection manager");
      connectionManager.cleanup();
    };
  }, []);
  
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
  
  // Setup connection manager when we have a session ID
  useEffect(() => {
    if (currentSession?.id) {
      logWithTimestamp(`Setting up connection manager with session ID: ${currentSession.id}`);
      
      // Initialize the connection manager with the session ID
      connectionManager.initialize(currentSession.id)
        .onSessionProgressUpdate((progress) => {
          logWithTimestamp(`Received session progress update: ${progress?.game_status || 'unknown status'}`);
          setConnectionState('connected');
        });
      
      setConnectionState('connecting');
    }
  }, [currentSession?.id]);
  
  // Initialize session state
  const isSessionActive = currentSession?.status === 'active';
  const isGameLive = currentSession?.lifecycle_state === 'live';
  
  // Get game status from sessionProgress
  const gameStatus = sessionProgress?.game_status || 'pending';
  const isGameActive = gameStatus === 'active';
  
  // Debug logging of game status with memoized stable values
  const statusInfo = React.useMemo(() => ({
    gameStatus,
    isSessionActive,
    isGameLive,
    isGameActive
  }), [gameStatus, isSessionActive, isGameLive, isGameActive]);

  // Debug logging with stable dependencies
  useEffect(() => {
    if (statusInfo.gameStatus) {
      logWithTimestamp(`Current game status from all sources: ${statusInfo.gameStatus}`);
      logWithTimestamp(`Session active: ${statusInfo.isSessionActive}, Game live: ${statusInfo.isGameLive}, Game active: ${statusInfo.isGameActive}`);
    }
  }, [statusInfo]);
  
  // Always initialize tickets hook with the same parameters, even if it will not be used
  const { tickets } = useTickets(playerCode, currentSession?.id);
  
  // Handle bingo claims
  const handleClaimBingo = useCallback(() => {
    if (!tickets || tickets.length === 0) {
      console.log("Cannot claim bingo: no tickets available");
      return Promise.resolve(false);
    }
    console.log("Claiming bingo with ticket:", tickets[0]);
    
    // Try to claim bingo
    return submitBingoClaim();
  }, [submitBingoClaim, tickets]);
  
  // Determine error message with better priority handling
  // For the waiting room, WebSocket errors should not be blockers
  const effectiveErrorMessage = playerCode 
    ? errorMessage || ''
    : "Player code is required. Please join the game again.";

  // Debug logging with stable dependencies
  useEffect(() => {
    console.log("PlayerGame render state:", {
      playerCode,
      playerName,
      isLoading,
      loadingStep,
      hasTickets: tickets && tickets.length > 0,
      hasSession: !!currentSession,
      sessionState: currentSession?.lifecycle_state,
      sessionStatus: currentSession?.status,
      gameState: currentGameState?.status,
      errorMessage: effectiveErrorMessage,
      sessionProgress
    });
  }, [
    playerCode, 
    playerName,
    isLoading, 
    loadingStep, 
    tickets, 
    currentSession, 
    currentGameState, 
    effectiveErrorMessage, 
    sessionProgress
  ]);

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
    
    // Pass session progress to loader
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={errorMessage}
        currentSession={currentSession}
        loadingStep={loadingStep}
        sessionProgress={sessionProgress}
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

  // Use session progress data for current state
  const finalCalledNumbers = sessionProgress?.called_numbers || calledItems || [];
  const finalLastCalledNumber = finalCalledNumbers.length > 0 
    ? finalCalledNumbers[finalCalledNumbers.length - 1] 
    : lastCalledItem;
  
  const currentWinPattern = sessionProgress?.current_win_pattern || 
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

  console.log("Rendering main player game interface with:");
  console.log("- Called numbers:", finalCalledNumbers.length);
  console.log("- Last called number:", finalLastCalledNumber);
  console.log("- Current win pattern:", currentWinPattern);
  console.log("- Prize info:", finalWinPrizes);
  console.log("- Player name:", playerName);
  console.log("- Connection state:", connectionState);

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
        playerName={playerName || ''}
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
        connectionState={connectionState}
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
