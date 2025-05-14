
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { logWithTimestamp } from "@/utils/logUtils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface PlayerLobbyProps {
  sessionName?: string;
  sessionId?: string | null;
  playerName?: string;
  onRefreshStatus?: () => void;
  errorMessage?: string | null;
  gameStatus?: string | null;
  brandingInfo?: any; // Added brandingInfo prop
}

export default function PlayerLobby({
  sessionName = "Game Session",
  sessionId,
  playerName,
  onRefreshStatus,
  errorMessage,
  gameStatus,
  brandingInfo // Added to props destructuring
}: PlayerLobbyProps) {
  // Log when the lobby component mounts for debugging
  useEffect(() => {
    logWithTimestamp(`PlayerLobby mounted: sessionId=${sessionId}, gameStatus=${gameStatus || 'null'}`, "info");
    
    // Setup a periodic status check to auto-refresh
    const intervalId = setInterval(() => {
      if (onRefreshStatus) {
        logWithTimestamp("Auto-refreshing lobby status", "debug");
        onRefreshStatus();
      }
    }, 15000); // Every 15 seconds
    
    return () => {
      clearInterval(intervalId);
      logWithTimestamp("PlayerLobby unmounted", "debug");
    };
  }, [sessionId, gameStatus, onRefreshStatus]);

  const handleRefresh = () => {
    if (onRefreshStatus) {
      logWithTimestamp("Player requested lobby refresh", "info");
      onRefreshStatus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{sessionName}</h2>
        
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-amber-700 mb-2">Waiting for Game to Start</h3>
          <div className="flex justify-center my-4">
            <LoadingSpinner size="md" className="text-amber-500" />
          </div>
          <p className="text-amber-600 mb-2">
            The caller is currently setting up the game. Please wait until they start the session.
          </p>
          
          {playerName && (
            <p className="text-amber-700 font-medium mt-2">
              Player: {playerName}
            </p>
          )}
          
          <p className="text-sm text-amber-500 mt-4">
            Your screen will automatically update when the game begins.
          </p>
        </div>
        
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h4 className="text-sm font-medium text-red-800">Connection Warning</h4>
            <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
          </div>
        )}
        
        <div className="flex items-center justify-center">
          <Button
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Status
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 mt-6">
          Game Status: {gameStatus || "pending"}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Session ID: {sessionId || "Unknown"}
        </p>
      </div>
    </div>
  );
}
