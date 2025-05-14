import React, { useState, useEffect, useCallback, ErrorInfo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PlayerGameHeader from '@/components/player/PlayerGameHeader';
import PlayerTicketView from '@/components/player/PlayerTicketView';
import PlayerGridView from '@/components/player/PlayerGridView';
import { useGameSession } from '@/hooks/useGameSession';
import { usePlayerTickets } from '@/hooks/usePlayerTickets';
import { useNumberUpdates } from '@/hooks/useNumberUpdates';
import { Button } from '@/components/ui/button';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, AlertTriangle, UserX } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { setupClaimDebugging } from '@/utils/claimDebugUtils';
import BingoClaim from '@/components/game/BingoClaim';
import { usePlayerClaimManagement } from '@/hooks/usePlayerClaimManagement';
import GameSheetControls from '@/components/game/GameSheetControls';
import PlayerGameControls from '@/components/game/PlayerGameControls';
import { useToast } from '@/components/ui/use-toast';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { useSessionProgress } from '@/hooks/useSessionProgress';
// Import the new PlayerGameLobby component instead of the old PlayerLobby
import PlayerGameLobby from '@/components/player/PlayerGameLobby';

// Error boundary component for the player game
class PlayerGameErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean, error: Error | null }
> {
  constructor(props: { children: React.ReactNode, onError: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logWithTimestamp(`Player Game Error: ${error.message}`, 'error');
    console.error("Player game error:", error, errorInfo);
    this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-xl font-bold mb-2">Game Error</h1>
          <p className="text-gray-700 mb-4 text-center">
            Sorry, something went wrong with the game. Please try refreshing.
          </p>
          <p className="text-sm text-red-700 mb-4 p-2 bg-red-100 rounded max-w-md overflow-auto">
            {this.state.error?.message || "Unknown error"}
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main player game component
const PlayerGame = () => {
  const { playerCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected } = useNetwork();
  const { player, setPlayer } = usePlayerContext();

  logWithTimestamp(`PlayerGame init with URL param playerCode: ${playerCode}`, 'info');

  const handleError = useCallback((error: Error) => {
    logWithTimestamp(`Player Game Critical Error: ${error.message}`, 'error');
    toast({
      title: "Game Error",
      description: "There was a problem with the game. Please try refreshing.",
      variant: "destructive",
    });
  }, [toast]);

  // Get the game code from either URL param or localStorage
  const gameCode = playerCode || localStorage.getItem('playerCode');

  // Ensure we have a game code, either from URL parameters or localStorage
  useEffect(() => {
    if (!gameCode) {
      logWithTimestamp('No game code found in URL or localStorage, redirecting to join page', 'warn');
      navigate('/player/join');
    } else {
      logWithTimestamp(`Using game code for session: ${gameCode}`, 'info');
    }
  }, [gameCode, navigate]);

  // Verify we have a game code
  if (!gameCode) {
    logWithTimestamp('Missing Game Code - rendering join suggestion', 'warn');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Missing Game Code</h1>
          <Button onClick={() => navigate('/player/join')}>Join a Game</Button>
        </div>
      </div>
    );
  }

  // Verify player info is available in context or localStorage
  const savedPlayerId = player?.id || localStorage.getItem('playerId');
  
  if (!savedPlayerId) {
    logWithTimestamp('No player ID found in context or localStorage', 'warn');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Player Information Missing</h1>
          <p className="mb-4">Please join the game again to continue.</p>
          <Button onClick={() => navigate('/player/join')}>Join Game</Button>
        </div>
      </div>
    );
  }

  return (
    <PlayerGameErrorBoundary onError={handleError}>
      <PlayerGameContent gameCode={gameCode} />
    </PlayerGameErrorBoundary>
  );
};

// Separated content component to work with the error boundary
const PlayerGameContent = ({ gameCode }: { gameCode: string }) => {
  const { 
    sessionDetails, 
    isLoadingSession, 
    sessionError, 
    currentWinPattern,
    gameType,
    playerId: fetchedPlayerId,
    playerName: fetchedPlayerName
  } = useGameSession(gameCode);

  // Get the session progress data for lobby/game status
  const {
    progress: sessionProgress,
    loading: loadingSessionProgress
  } = useSessionProgress(sessionDetails?.id);

  const { 
    playerTickets, 
    isLoadingTickets, 
    ticketError,
    currentWinningTickets,
    refreshTickets,
    isRefreshingTickets
  } = usePlayerTickets(sessionDetails?.id);

  const { 
    calledNumbers, 
    currentNumber,
    numberCallTimestamp,
    isConnected: numbersConnected,
    reconnect: reconnectNumberUpdates
  } = useNumberUpdates(sessionDetails?.id);

  const [isTicketView, setIsTicketView] = useState(true);
  const { player, setPlayer } = usePlayerContext();
  const { session, user } = useAuth();
  const [claimDebuggingCleanup, setClaimDebuggingCleanup] = useState<(() => void) | null>(null);
  const { isConnected } = useNetwork();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get player ID from multiple possible sources in priority order
  const playerId = fetchedPlayerId || player?.id || session?.user?.id || localStorage.getItem('playerId');
  const playerName = fetchedPlayerName || player?.name || (session?.user ? session.user.email : null) || localStorage.getItem('playerName');

  // Update the player context with the fetched player information if needed
  useEffect(() => {
    if (fetchedPlayerId && !player?.id && gameCode) {
      logWithTimestamp(`Updating player context with fetched player info: ${fetchedPlayerId}`, 'info');
      // If the PlayerContext doesn't have the player ID but we got it from the API, update it
      if (setPlayer) {
        setPlayer({
          id: fetchedPlayerId,
          name: fetchedPlayerName || 'Player',
          code: gameCode,
          sessionId: sessionDetails?.id
        });
      }
    }
  }, [fetchedPlayerId, fetchedPlayerName, gameCode, player, sessionDetails?.id, setPlayer]);

  // For debugging, log the session progress
  useEffect(() => {
    if (sessionProgress) {
      logWithTimestamp(`PlayerGame: Session progress loaded - game_status: ${sessionProgress.game_status || 'null'}`, 'info');
    }
  }, [sessionProgress]);

  // Player claim management
  const {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  } = usePlayerClaimManagement(
    gameCode,
    playerId || '',
    sessionDetails?.id || null,
    playerName || 'Player',
    gameType || 'mainstage',
    currentWinPattern || null
  );

  // Set up claim debugging utilities
  useEffect(() => {
    // Initialize claim debugging
    const cleanup = setupClaimDebugging();
    setClaimDebuggingCleanup(() => cleanup);

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Toggle between ticket view and grid view
  const toggleView = useCallback(() => {
    setIsTicketView(prev => !prev);
  }, []);

  // Handle bingo claim
  const handleClaimBingo = useCallback(async () => {
    if (!playerTickets || playerTickets.length === 0) {
      logWithTimestamp('Cannot claim: No tickets', 'warn');
      toast({
        title: "No Tickets Available",
        description: "You don't have any tickets to claim a prize with.",
        variant: "destructive"
      });
      return false;
    }

    // Find the first winning ticket
    const winningTicket = playerTickets.find(ticket => 
      ticket.is_winning || ticket.winning_pattern === currentWinPattern
    );

    if (!winningTicket) {
      logWithTimestamp('No winning tickets found', 'warn');
      toast({
        title: "No Winning Ticket",
        description: "None of your tickets match the winning pattern yet.",
        variant: "destructive"
      });
      return false;
    }

    logWithTimestamp(`Submitting claim for ticket ${winningTicket.serial}`, 'info');
    return await submitClaim(winningTicket);
  }, [playerTickets, currentWinPattern, submitClaim, toast]);

  // Handle connection refresh
  const handleRefreshConnection = useCallback(() => {
    reconnectNumberUpdates();
    refreshTickets();
    logWithTimestamp('Manually refreshing connection and tickets', 'info');
    toast({
      title: "Refreshing",
      description: "Reconnecting to game and refreshing tickets...",
    });
  }, [reconnectNumberUpdates, refreshTickets, toast]);

  // If there's no playerId, we can't continue
  if (!playerId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <UserX className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Player Not Found</h1>
          <p className="mb-4">We couldn't find your player information. Please join the game again.</p>
          <Button onClick={() => navigate('/player/join')}>Join Game</Button>
        </div>
      </div>
    );
  }

  // Handle various loading and error states
  if (isLoadingSession || isLoadingTickets || loadingSessionProgress) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading your game...</p>
      </div>
    </div>;
  }

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-gray-700 mb-4 text-center">
          {sessionError === 'Player not found with this code' 
            ? "We couldn't find a player with your code. Please join again."
            : sessionError === 'Player has no associated game session' 
              ? "Your player code isn't linked to an active game session."
              : sessionError}
        </p>
        <div className="space-x-2">
          <Button onClick={() => navigate('/player/join')}>
            Return to Join
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (ticketError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Error Loading Tickets</h1>
        <p className="text-gray-700 mb-4 text-center">
          {ticketError}
        </p>
        <div className="space-x-2">
          <Button onClick={() => refreshTickets()} disabled={isRefreshingTickets}>
            Refresh Tickets
          </Button>
          <Button variant="outline" onClick={() => navigate('/player/join')}>
            Join a Different Game
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <X className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-gray-700 mb-4">
          The game you're looking for doesn't exist or has ended.
        </p>
        <Button onClick={() => navigate('/player/join')}>
          Join a Game
        </Button>
      </div>
    );
  }

  // Check if we should show the lobby based on session progress
  const showLobby = !sessionProgress?.game_status || 
                    sessionProgress.game_status === 'pending' || 
                    sessionDetails.lifecycle_state === 'setup' || 
                    sessionDetails.lifecycle_state === 'lobby';

  logWithTimestamp(`PlayerGame: Lobby check - showLobby: ${showLobby}, game_status: ${sessionProgress?.game_status || 'null'}, lifecycle_state: ${sessionDetails.lifecycle_state || 'unknown'}`, 'info');

  // If the game is in lobby/pending state, show the lobby
  if (showLobby) {
    return (
      <PlayerGameLobby
        sessionName={sessionDetails.name}
        sessionId={sessionDetails.id}
        playerName={playerName || undefined}
        onRefreshStatus={refreshTickets}
        errorMessage={null}
        gameStatus={sessionProgress?.game_status}
      />
    );
  }

  // Otherwise, show the main game view
  return (
    <div className="pb-20">
      <PlayerGameHeader 
        sessionName={sessionDetails.name}
        callerName={sessionDetails.callerName}
        lastNumber={currentNumber}
        timestamp={numberCallTimestamp}
        gameType={gameType || 'mainstage'}
        pattern={currentWinPattern || 'No active pattern'}
      />

      {isTicketView ? (
        <PlayerTicketView 
          tickets={playerTickets || []} 
          calledNumbers={calledNumbers || []}
          lastCalledNumber={currentNumber}
          currentWinPattern={currentWinPattern}
        />
      ) : (
        <PlayerGridView 
          calledNumbers={calledNumbers || []}
          lastCalledNumber={currentNumber}
          gameType={gameType || 'mainstage'}
        />
      )}

      <PlayerGameControls 
        isConnected={isConnected && numbersConnected}
        onToggleTicketView={toggleView}
        onRefreshConnection={handleRefreshConnection}
        isTicketView={isTicketView}
        showTicketToggle={true}
      />

      <GameSheetControls
        onClaimBingo={handleClaimBingo}
        onRefreshTickets={refreshTickets}
        claimStatus={claimStatus}
        isClaiming={isSubmittingClaim}
        isRefreshing={isRefreshingTickets}
        winningTickets={currentWinningTickets?.length || 0}
        totalTickets={playerTickets?.length || 0}
        sessionId={sessionDetails.id}
        playerId={playerId}
      />

      <BingoClaim
        claimStatus={claimStatus}
        isClaiming={isSubmittingClaim}
        resetClaimStatus={resetClaimStatus}
        playerName={playerName || 'Player'}
        sessionId={sessionDetails.id}
        playerId={playerId}
        calledNumbers={calledNumbers}
        currentTicket={currentWinningTickets && currentWinningTickets.length > 0 
          ? currentWinningTickets[0] 
          : playerTickets && playerTickets.length > 0 ? playerTickets[0] : null}
      />
    </div>
  );
};

export default PlayerGame;
