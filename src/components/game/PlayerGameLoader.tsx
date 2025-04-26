
import React from "react";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/types";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  isLoading: boolean;
  errorMessage: string | null;
  currentSession: GameSession | null;
}

export default function PlayerGameLoader({ isLoading, errorMessage, currentSession }: Props) {
  console.log("PlayerGameLoader - Session data:", currentSession);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-bingo-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center mb-4 text-red-600">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">Something went wrong</h2>
          <p className="text-gray-700 mb-6 text-center">{errorMessage}</p>
          <div className="flex justify-center">
            <Button onClick={() => window.location.href = '/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <Button onClick={() => window.location.href = '/join'}>
              Join a Different Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Log the session state in more detail
  console.log("Current session state:", {
    id: currentSession.id,
    name: currentSession.name,
    lifecycle: currentSession.lifecycle_state,
    status: currentSession.status,
    gameState: currentSession.current_game_state,
    gameStatus: currentSession.current_game_state?.status
  });

  // Refine the game state check with proper null safety and improved condition logic
  const isGameLive = currentSession.lifecycle_state === 'live';
  const isSessionActive = currentSession.status === 'active';
  const hasCurrentGameState = !!currentSession.current_game_state;
  const isGameActive = hasCurrentGameState && currentSession.current_game_state.status === 'active';

  console.log("Game state check:", { isGameLive, isSessionActive, hasCurrentGameState, isGameActive });

  if (!isGameLive || !isSessionActive || !isGameActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
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
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-500 mb-1">
                Session: {currentSession.name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500 mb-1">
                Lifecycle state: {currentSession.lifecycle_state || 'unknown'}
              </p> 
              <p className="text-sm text-gray-500">
                Status: {currentSession.status || 'unknown'}
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

  return null;
}
