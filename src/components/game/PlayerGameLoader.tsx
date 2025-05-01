import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/types";
import { AlertCircle, RefreshCw, Info, Calendar, Clock, Wifi, WifiOff } from "lucide-react";

// Helper function for consistent timestamped logging
const logWithTimestamp = (message: string) => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] - CHANGED 18:19 - ${message}`);
};

interface Props {
  isLoading: boolean;
  errorMessage: string | null;
  currentSession: GameSession | null;
  loadingStep?: string;
  sessionProgress?: any;
}

export default function PlayerGameLoader({ 
  isLoading, 
  errorMessage, 
  currentSession, 
  loadingStep = "initializing",
  sessionProgress 
}: Props) {
  // Create stable references for dependencies to prevent React error #310
  const stableSession = React.useMemo(() => currentSession, [currentSession?.id]);
  const stableProgress = React.useMemo(() => sessionProgress, [
    sessionProgress?.game_status,
    sessionProgress?.current_game_number
  ]);
  
  // Only log when there's a change to help debug flickering
  useEffect(() => {
    if (stableSession) {
      logWithTimestamp("PlayerGameLoader - Session data: " + JSON.stringify(stableSession));
    }
    logWithTimestamp("PlayerGameLoader - Loading step: " + loadingStep);
    if (stableProgress) {
      logWithTimestamp("PlayerGameLoader - Session progress: " + JSON.stringify(stableProgress));
    }
  }, [stableSession, loadingStep, stableProgress]);

  // Format date and time for display
  const formatSessionDate = (dateStr?: string) => {
    if (!dateStr) return 'Not specified';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  };

  // Format time in user's locale
  const formatSessionTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      // If we have ISO string with time
      if (timeStr.includes('T')) {
        const date = new Date(timeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return timeStr;
    } catch (e) {
      return '';
    }
  };

  // If we're in a loading state, show the loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin h-12 w-12 border-4 border-bingo-primary border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading game...</h2>
          <p className="text-gray-500 mb-4">Please wait while we get everything ready</p>
          <p className="text-xs text-gray-400">{loadingStep || "initializing"}...</p>
        </div>
      </div>
    );
  }

  // If there's a critical error that prevents loading the session, show error message
  if (errorMessage && !currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center mb-4 text-red-600">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">Something went wrong</h2>
          <p className="text-gray-700 mb-6 text-center">{errorMessage}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => window.location.reload()} 
                    variant="outline" 
                    className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => window.location.href = '/player/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If there's no session data
  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Session not found</h2>
          <p className="text-gray-600 mb-4 text-center">
            The game session could not be found or is no longer available.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => window.location.href = '/player/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  console.log("In waiting room - Progress data:", sessionProgress);
  console.log("Session data:", currentSession);
  
  // Check if the game is in an active state
  const isGameLive = currentSession?.lifecycle_state === 'live';
  const isSessionActive = currentSession?.status === 'active';
  const gameStatus = sessionProgress?.game_status || 'pending';
  const isGameActive = gameStatus === 'active';
  
  // Log game state info without using useEffect to avoid dependency issues
  logWithTimestamp(`Loader state check - Session active: ${isSessionActive}, Game live: ${isGameLive}, Game status: ${gameStatus}, Game active: ${isGameActive}`);
  
  // FIX: Get session time from appropriate fields - fixing type errors
  // Instead of using currentSession.sessionTime (which doesn't exist on type)
  // Use either a custom session time field from progress or format the session date
  const sessionTime = sessionProgress?.session_time || formatSessionTime(currentSession.sessionDate);

  // If the game is not active yet, show waiting message
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-center mb-4 text-amber-500">
          <Info size={40} />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{currentSession.name}</h2>
        
        {/* Session details */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{formatSessionDate(currentSession.sessionDate)}</span>
            {sessionTime && <span className="ml-1">{sessionTime}</span>}
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-1" />
            <span>Game {currentSession.current_game} of {currentSession.numberOfGames}</span>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-amber-600 mb-4 text-center">Waiting for game to start</h3>
        
        <p className="text-gray-600 mb-6 text-center">
          {!isGameLive 
            ? "The caller has not started the game yet." 
            : !isSessionActive
              ? "The session is live but not yet active."
              : !isGameActive 
                ? "The game is waiting to be activated." 
                : "The game is being set up..."}
        </p>
        
        {/* Show connection error as a warning, not a blocking error */}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-300 rounded-md p-4 mb-6">
            <div className="flex">
              {errorMessage.includes('connection') || errorMessage.includes('WebSocket') ? (
                <WifiOff className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-medium text-amber-800">Connection Warning</h4>
                <p className="text-sm text-amber-700 mt-1">{errorMessage}</p>
                <p className="text-xs text-amber-600 mt-2">You'll still be able to join when the game starts.</p>
              </div>
            </div>
            <Button 
              variant="outline"
              size="sm"
              className="w-full mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reconnect
            </Button>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500 mb-2">
              <span className="font-semibold">Session:</span> {currentSession.name || 'Unknown'}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              <span className="font-semibold">Lifecycle state:</span> {currentSession.lifecycle_state || 'unknown'}
            </p> 
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Status:</span> {currentSession.status || 'unknown'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              <span className="font-semibold">Game status:</span> {gameStatus || 'unknown'}
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
