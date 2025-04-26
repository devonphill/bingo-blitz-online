
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { Button } from '@/components/ui/button';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import BingoWinProgress from '@/components/game/BingoWinProgress';
import { GameType } from '@/types';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use the player code from the URL or localStorage
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    if (urlPlayerCode) {
      setPlayerCode(urlPlayerCode);
      localStorage.setItem('playerCode', urlPlayerCode);
    } else if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
    } else {
      // If no player code is found, redirect to join page
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/join');
    }
  }, [urlPlayerCode, navigate, toast]);

  const {
    tickets,
    playerName,
    playerId,
    currentSession,
    currentGameState,
    calledItems, 
    lastCalledItem,
    activeWinPatterns,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    handleClaimBingo,
    isClaiming,
    claimStatus,
    gameType,
  } = usePlayerGame(playerCode);

  // Custom check for game ready state 
  const isGameReady = currentSession?.lifecycle_state === 'live' && 
                     currentGameState?.status === 'active';

  // Show loader for different states
  if (!playerCode || isLoading || errorMessage) {
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={errorMessage} 
        currentSession={currentSession} 
      />
    );
  }

  // If game is not ready yet, show a proper waiting message
  if (!isGameReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waiting for game to start</h2>
          <p className="text-gray-600 mb-4">
            {currentSession?.lifecycle_state === 'live' 
              ? "The caller is setting up the game..." 
              : "The caller has not started the game yet."}
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <p className="mt-2 text-3xl leading-8 font-bold tracking-tight text-gray-900 sm:text-4xl">
            Welcome, {playerName}!
          </p>
          <p className="text-md text-gray-500">
            Session: {currentSession.name} ({currentSession.accessCode})
          </p>
          {gameType && (
            <p className="text-md text-gray-500">
              Game Type: {gameType}
            </p>
          )}
          {lastCalledItem && (
            <p className="text-md text-gray-500">
              Last Number Called: {lastCalledItem}
            </p>
          )}
          <div className="flex items-center justify-center mt-4">
            <label htmlFor="autoMarking" className="mr-2 text-gray-700">Auto Marking:</label>
            <input
              type="checkbox"
              id="autoMarking"
              checked={autoMarking}
              onChange={(e) => setAutoMarking(e.target.checked)}
              className="form-checkbox h-5 w-5 text-indigo-600 transition duration-150 ease-in-out"
            />
          </div>
        </div>

        <div className="mt-10">
          <GameTypePlayspace
            gameType={(gameType as GameType) || 'mainstage'}
            tickets={tickets}
            calledNumbers={calledItems}
            autoMarking={autoMarking}
          />
        </div>

        <div className="mt-8 lg:text-center">
          {claimStatus === 'pending' ? (
            <p className="text-yellow-500">Your claim is being processed...</p>
          ) : claimStatus === 'validated' ? (
            <p className="text-green-500">Congratulations! Your claim has been validated!</p>
          ) : claimStatus === 'rejected' ? (
            <p className="text-red-500">Your claim was rejected. Please continue playing.</p>
          ) : (
            <Button
              onClick={handleClaimBingo}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim Bingo!'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
