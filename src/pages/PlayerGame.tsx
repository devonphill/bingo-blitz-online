
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
import { useAuth } from '@/hooks/useAuth'; // Fixed import
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, AlertTriangle } from 'lucide-react';
import { logWithTimestamp } from '@/utils/logUtils';
import { setupClaimDebugging } from '@/utils/claimDebugUtils';
import BingoClaim from '@/components/game/BingoClaim';
import { usePlayerClaimManagement } from '@/hooks/usePlayerClaimManagement';
import GameSheetControls from '@/components/game/GameSheetControls';
import PlayerGameControls from '@/components/game/PlayerGameControls';
import { useToast } from '@/hooks/use-toast';
import { useNetwork } from '@/contexts/NetworkStatusContext';

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
  const { gameCode } = useParams();
  const navigate = useNavigate(); // Fixed variable name
  const { toast } = useToast();
  const { isConnected } = useNetwork();

  const handleError = useCallback((error: Error) => {
    logWithTimestamp(`Player Game Critical Error: ${error.message}`, 'error');
    toast({
      title: "Game Error",
      description: "There was a problem with the game. Please try refreshing.",
      variant: "destructive",
    });
  }, [toast]);

  if (!gameCode) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Missing Game Code</h1>
          <Button onClick={() => navigate('/')}>Return Home</Button>
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
    gameType
  } = useGameSession(gameCode);

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
  const { player } = usePlayerContext();
  const { session } = useAuthContext();
  const [claimDebuggingCleanup, setClaimDebuggingCleanup] = useState<(() => void) | null>(null);
  const { isConnected } = useNetwork();

  // Player claim management
  const {
    claimStatus,
    isSubmittingClaim,
    submitClaim,
    resetClaimStatus,
    hasActiveClaims
  } = usePlayerClaimManagement(
    gameCode,
    player?.id || session?.user?.id || null,
    sessionDetails?.id || null,
    player?.name || session?.user?.email || null,
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
      return false;
    }

    // Find the first winning ticket
    const winningTicket = playerTickets.find(ticket => 
      ticket.isWinning || ticket.winningPattern === currentWinPattern
    );

    if (!winningTicket) {
      logWithTimestamp('No winning tickets found', 'warn');
      return false;
    }

    logWithTimestamp(`Submitting claim for ticket ${winningTicket.serial}`, 'info');
    return await submitClaim(winningTicket);
  }, [playerTickets, currentWinPattern, submitClaim]);

  // Handle connection refresh
  const handleRefreshConnection = useCallback(() => {
    reconnectNumberUpdates();
    refreshTickets();
    logWithTimestamp('Manually refreshing connection and tickets', 'info');
  }, [reconnectNumberUpdates, refreshTickets]);

  // Handle various loading and error states
  if (isLoadingSession || isLoadingTickets) {
    return <div className="flex items-center justify-center h-screen">
      <LoadingSpinner size="lg" />
    </div>;
  }

  if (sessionError || ticketError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Error Loading Game</h1>
        <p className="text-gray-700 mb-4 text-center">
          {sessionError || ticketError || "Failed to load the game. Please try again."}
        </p>
        <div className="space-x-2">
          <Button onClick={() => navigate('/')}>
            Return Home
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
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
        <Button onClick={() => navigate('/')}>
          Return Home
        </Button>
      </div>
    );
  }

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
        playerId={player?.id || session?.user?.id}
      />

      <BingoClaim
        claimStatus={claimStatus}
        isClaiming={isSubmittingClaim}
        resetClaimStatus={resetClaimStatus}
        playerName={player?.name || session?.user?.email || 'Player'}
        sessionId={sessionDetails.id}
        playerId={player?.id || session?.user?.id}
        calledNumbers={calledNumbers}
        currentTicket={currentWinningTickets && currentWinningTickets.length > 0 
          ? currentWinningTickets[0] 
          : playerTickets && playerTickets.length > 0 ? playerTickets[0] : null}
      />
    </div>
  );
};

export default PlayerGame;
