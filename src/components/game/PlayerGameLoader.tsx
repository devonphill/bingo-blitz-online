
import React from "react";
import { Button } from "@/components/ui/button";
import { GameSession } from "@/types";

interface Props {
  isLoading: boolean;
  errorMessage: string | null;
  currentSession: GameSession | null;
}

export default function PlayerGameLoader({ isLoading, errorMessage, currentSession }: Props) {
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

  // Debug the actual values to help trace the issue
  console.log("Current session state:", {
    lifecycle: currentSession.lifecycle_state,
    gameState: currentSession.current_game_state,
    status: currentSession.current_game_state?.status
  });

  // Fix the game state check with proper null safety and improved condition logic
  const isGameLive = currentSession.lifecycle_state === 'live';
  const isGameActive = currentSession.current_game_state?.status === 'active';

  if (!isGameLive || !isGameActive) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">
            {!isGameLive 
              ? "The caller has not started the game yet." 
              : "The game is being set up..."}
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
