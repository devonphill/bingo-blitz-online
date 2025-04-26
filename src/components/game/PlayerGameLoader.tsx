
import React from "react";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/types";

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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading game...</h2>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-700 mb-6">{errorMessage}</p>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session not found</h2>
          <p className="text-gray-600 mb-4">The game session could not be found.</p>
          <Button onClick={() => window.location.href = '/join'}>
            Join a Game
          </Button>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">
            {!isGameLive 
              ? "The caller has not started the game yet." 
              : !isSessionActive
                ? "The session is live but not yet active."
                : !isGameActive 
                  ? "The game is waiting to be activated." 
                  : "The game is being set up..."}
          </p>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Session lifecycle: {currentSession.lifecycle_state || 'unknown'}, 
              Status: {currentSession.status || 'unknown'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
