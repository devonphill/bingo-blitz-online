
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { Button } from '@/components/ui/button';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import BingoWinProgress from '@/components/game/BingoWinProgress';
import { GameType } from '@/types';

export default function PlayerGame() {
  const { playerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const calledNumbers = calledItems;
  const currentNumber = lastCalledItem;

  if (!playerCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Player Code Missing</h2>
          <Button onClick={() => navigate('/join')}>
            Return to Join
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Game...</h2>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error: {errorMessage}</h2>
          <Button onClick={() => navigate('/join')}>
            Return to Join
          </Button>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h2>
          <p>Please ensure you have the correct player code.</p>
          <Button onClick={() => navigate('/join')}>
            Return to Join
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
          {currentNumber && (
            <p className="text-md text-gray-500">
              Last Number Called: {currentNumber}
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
