import React, { useEffect, useCallback, useState, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Initialize states early
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const [loadingPlayerCode, setLoadingPlayerCode] = useState(true);
  const [finalCalledNumbers, setFinalCalledNumbers] = useState<number[]>([]);
  const [finalLastCalledNumber, setFinalLastCalledNumber] = useState<number | null>(null);
  
  // Handle player code initialization - only run once on mount
  useEffect(() => {
    const initializePlayerCode = () => {
      logWithTimestamp(`PlayerGame initialized with playerCode from URL: ${urlPlayerCode}`, 'info');
      
      // Priority 1: Use URL parameter if available
      if (urlPlayerCode && urlPlayerCode.trim() !== '') {
        logWithTimestamp(`Using player code from URL: ${urlPlayerCode}`, 'info');
        localStorage.setItem('playerCode', urlPlayerCode);
        setPlayerCode(urlPlayerCode);
        setLoadingPlayerCode(false);
        return;
      } 
    
      // Priority 2: Use stored player code if available
      const storedPlayerCode = localStorage.getItem('playerCode');
      
      if (storedPlayerCode && storedPlayerCode.trim() !== '') {
        logWithTimestamp(`Using stored player code: ${storedPlayerCode}`, 'info');
        setPlayerCode(storedPlayerCode);
        
        // Redirect to have the code in the URL for better bookmarking/sharing
        // But only if we're on the player/game route without a code
        if (window.location.pathname === '/player/game' || window.location.pathname === '/player/game/') {
          navigate(`/player/game/${storedPlayerCode}`, { replace: true });
        }
        
        setLoadingPlayerCode(false);
        return;
      }
      
      // Home route handling - if we're on the home page, don't show error or redirect
      if (window.location.pathname === '/') {
        logWithTimestamp("On home page, not showing player code error", 'info');
        setLoadingPlayerCode(false);
        setPlayerCode(null);
        return;
      }
      
      // If we're on the player game path but no player code, redirect to join page
      if (window.location.pathname.includes('/player/game')) {
        logWithTimestamp("No player code found, redirecting to join page", 'info');
        localStorage.removeItem('playerCode'); // Clear any invalid codes
        toast({
          title: 'Player Code Missing',
          description: 'Please enter your player code to join the game.',
          variant: 'destructive'
        });
        navigate('/player/join');
        return;
      }
      
      // Otherwise just finish loading with no player code
      setLoadingPlayerCode(false);
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
    handleClaimBingo: submitBingoClaim,
    connectionState: hookConnectionState
  } = usePlayerGame(playerCode);
  
  // Initialize session progress hook - but only use it if we have a valid session
  const { progress: sessionProgress } = useSessionProgress(
    currentSession?.id
  );
  
  // Local state for connection and real-time data
  const [effectiveConnectionState, setEffectiveConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    hookConnectionState || 'disconnected'
  );
  
  // Connection monitoring ref
  const connectionMonitorRef = useRef<number | null>(null);
  
  // Manual connection check function
  const checkConnectionStatus = useCallback(() => {
    const isConnected = connectionManager.isConnected();
    // Only update if it's different to prevent unnecessary renders
    if ((isConnected && effectiveConnectionState !== 'connected') || 
        (!isConnected && effectiveConnectionState === 'connected')) {
      setEffectiveConnectionState(isConnected ? 'connected' : 'disconnected');
    }
  }, [effectiveConnectionState]);
  
  // Set up a direct connection status check that runs every 2 seconds
  useEffect(() => {
    if (connectionMonitorRef.current) {
      window.clearInterval(connectionMonitorRef.current);
    }
    
    connectionMonitorRef.current = window.setInterval(() => {
      checkConnectionStatus();
    }, 2000);
    
    return () => {
      if (connectionMonitorRef.current) {
        window.clearInterval(connectionMonitorRef.current);
        connectionMonitorRef.current = null;
      }
    };
  }, [checkConnectionStatus]);
  
  // Update effective connection state from hook with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      // Update the connection state but also check the direct connection status
      const isDirectlyConnected = connectionManager.isConnected();
      
      // Important: Don't override a connected state with a connecting state
      if (hookConnectionState === 'connecting' && isDirectlyConnected) {
        setEffectiveConnectionState('connected');
        return;
      }
      
      const newState = isDirectlyConnected ? 'connected' : hookConnectionState;
      setEffectiveConnectionState(newState);
      
      // Log the connection state for debugging
      logWithTimestamp(`PlayerGame: Connection state from hook: ${hookConnectionState}, direct check: ${isDirectlyConnected ? 'connected' : 'disconnected'}, effective: ${newState}`);
      
      // If we're still disconnected, try to reconnect
      if (newState !== 'connected' && currentSession?.id) {
        logWithTimestamp('PlayerGame: Still disconnected, attempting reconnect');
        
        // Only call connect() if we're not already connecting or connected
        if (hookConnectionState !== 'connecting' && !isDirectlyConnected) {
          connectionManager.connect();
        }
      }
    }, 1000); // Wait 1 second before updating connection state to prevent flickering
    
    return () => clearTimeout(timer);
  }, [hookConnectionState, currentSession?.id]);
  
  // Always initialize tickets hook with the same parameters, even if it will not be used
  const { tickets, refreshTickets } = useTickets(playerCode, currentSession?.id);

  // Set up a SINGLE real-time connection using the connection manager
  useEffect(() => {
    if (!currentSession?.id || !playerCode || !playerId) {
      logWithTimestamp("No session ID or player info available, skipping connection setup");
      return;
    }
    
    logWithTimestamp(`Setting up unified connection management for session ${currentSession.id}`);
    
    // Set up event handlers first
    connectionManager
      .onNumberCalled((lastCalledNumber, calledNumbers) => {
        if (lastCalledNumber && calledNumbers.length > 0) {
          logWithTimestamp(`Received number call update: ${lastCalledNumber}, total: ${calledNumbers.length}`);
          setFinalCalledNumbers(calledNumbers);
          setFinalLastCalledNumber(lastCalledNumber);
          
          // Show toast for new number
          toast({
            title: `Number Called: ${lastCalledNumber}`,
            description: "New number has been called",
            duration: 3000
          });
        }
      })
      .onSessionProgressUpdate((progress) => {
        if (progress?.called_numbers && progress.called_numbers.length > 0) {
          const lastCalledNumber = progress.called_numbers[progress.called_numbers.length - 1];
          logWithTimestamp(`Received session progress with ${progress.called_numbers.length} numbers, last: ${lastCalledNumber}`);
          
          setFinalCalledNumbers(progress.called_numbers);
          setFinalLastCalledNumber(lastCalledNumber);
        }
      });
    
    // Now actively connect to the channel
    // The initialization happens in usePlayerGame, we just need to ensure we're connected here
    connectionManager.connect();
    
    // No cleanup needed as the connectionManager handles its own lifecycle
  }, [currentSession?.id, playerCode, playerId, toast]);
  
  // Update the finalCalledNumbers whenever our data sources change
  useEffect(() => {
    // Use the latest data from any source
    const latestCalledNumbers = sessionProgress?.called_numbers || 
                               currentGameState?.calledNumbers || 
                               calledItems || [];
                               
    if (latestCalledNumbers && latestCalledNumbers.length > 0) {
      setFinalCalledNumbers(latestCalledNumbers);
      
      const latestLastCalledNumber = latestCalledNumbers.length > 0 
        ? latestCalledNumbers[latestCalledNumbers.length - 1] 
        : lastCalledItem;
        
      setFinalLastCalledNumber(latestLastCalledNumber);
      
      // Log for debugging
      logWithTimestamp(`Updated called numbers: ${latestCalledNumbers.length} numbers, last: ${latestLastCalledNumber}`);
    }
  }, [sessionProgress, calledItems, lastCalledItem, currentGameState]);
  
  // Handle bingo claims - select the best ticket for claiming
  const handleClaimBingo = useCallback(() => {
    if (!tickets || tickets.length === 0) {
      console.log("Cannot claim bingo: no tickets available");
      return Promise.resolve(false);
    }
    
    // Sort tickets to find the best one to submit for claiming
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => finalCalledNumbers.includes(num));
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched: Math.round((matchedNumbers.length / ticket.numbers.length) * 100),
      };
    });
    
    // Sort tickets by score (highest first)
    const sortedTickets = [...ticketsWithScore].sort((a, b) => b.score - a.score);
    
    // Use the best ticket for the claim
    const bestTicket = sortedTickets[0];
    
    console.log("Claiming bingo with best ticket:", bestTicket);
    
    // Try to claim bingo
    return submitBingoClaim(bestTicket);
  }, [submitBingoClaim, tickets, finalCalledNumbers]);
  
  // Only consider connection issues as non-critical errors
  const effectiveErrorMessage = !playerCode && window.location.pathname.includes('/player/game')
    ? "Player code is required. Please join the game again."
    : (errorMessage && !errorMessage.toLowerCase().includes("connection") && !errorMessage.toLowerCase().includes("websocket")) 
      ? errorMessage 
      : '';

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
  
  // If we're on the home page, no player code is required - just return nothing
  if (window.location.pathname === '/') {
    return null;
  }
  
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const hasSession = !!currentSession;

  // Don't block for connection issues, just show the loader for real issues
  const shouldShowLoader = 
    isInitialLoading || 
    (!hasSession && !!effectiveErrorMessage) || // Only block on critical errors
    !hasSession;

  if (shouldShowLoader) {
    logWithTimestamp(`Showing PlayerGameLoader - isLoading: ${isLoading}, hasSession: ${hasSession}, effectiveErrorMessage: ${effectiveErrorMessage}`);
    
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={effectiveErrorMessage}
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
  
  const currentWinPattern = sessionProgress?.current_win_pattern || 
                           (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  const currentGameNumber = sessionProgress?.current_game_number || 
                           currentGameState?.gameNumber || 
                           currentSession?.current_game || 
                           1;
                           
  const numberOfGames = sessionProgress?.max_game_number || 
                       currentSession?.numberOfGames || 
                       currentSession?.number_of_games ||
                       1;

  let finalWinPrizes = winPrizes;
  if (sessionProgress?.current_win_pattern && sessionProgress?.current_prize) {
    finalWinPrizes = {
      ...finalWinPrizes,
      [sessionProgress.current_win_pattern]: sessionProgress.current_prize
    };
  }

  logWithTimestamp("Rendering main player game interface with:");
  logWithTimestamp(`- Called numbers: ${finalCalledNumbers.length}`);
  logWithTimestamp(`- Last called number: ${finalLastCalledNumber}`);
  logWithTimestamp(`- Current win pattern: ${currentWinPattern}`);
  logWithTimestamp(`- Player name: ${playerName}`);
  logWithTimestamp(`- Connection state: ${effectiveConnectionState}`);
  
  // Map the claimStatus to the proper format expected by each component
  const layoutClaimStatus = claimStatus === 'valid' ? 'valid' : 
                          claimStatus === 'invalid' ? 'invalid' : 
                          claimStatus === 'pending' ? 'pending' : 
                          'none';
                          
  // Convert the claimStatus to the type required by GameTypePlayspace
  // Always use 'pending' if the value is 'none' since GameTypePlayspace doesn't accept 'none'
  const gameTypePlayspaceClaimStatus: 'validated' | 'rejected' | 'pending' = 
    claimStatus === 'valid' ? 'validated' : 
    claimStatus === 'invalid' ? 'rejected' : 
    'pending'; // Default to pending instead of 'none'

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
        claimStatus={layoutClaimStatus}
        gameType={gameType}
        currentGameNumber={currentGameNumber}
        numberOfGames={numberOfGames}
        connectionState={effectiveConnectionState}
        onRefreshTickets={refreshTickets}
        sessionId={currentSession?.id}
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
          claimStatus={gameTypePlayspaceClaimStatus}
        />
      </PlayerGameLayout>
    </React.Fragment>
  );
}
