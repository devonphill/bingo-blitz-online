
import React from "react";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/types";
import { AlertCircle, RefreshCw, Info } from "lucide-react";

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
  // Only log when there's a change to help debug flickering
  const logCacheKey = `${isLoading}-${!!errorMessage}-${!!currentSession}-${loadingStep}`;
  React.useEffect(() => {
    console.log("PlayerGameLoader - Session data:", currentSession);
    console.log("PlayerGameLoader - Loading step:", loadingStep);
  }, [logCacheKey, currentSession, loadingStep]);

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

  // If there's an error, show the error message
  if (errorMessage) {
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
  const isGameLive = currentSession.lifecycle_state === 'live';
  const isSessionActive = currentSession.status === 'active';
  const gameStatus = sessionProgress?.game_status || 'pending';
  const isGameActive = gameStatus === 'active';

  // If the game is not active yet, show waiting message
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-center mb-4 text-amber-500">
          <Info size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Waiting for game to start</h2>
        <p className="text-gray-600 mb-4 text-center">
          {!isGameLive 
            ? "The caller has not started the game yet." 
            : !isSessionActive
              ? "The session is live but not yet active."
              : !isGameActive 
                ? "The game is waiting to be activated." 
                : "The game is being set up..."}
        </p>
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
