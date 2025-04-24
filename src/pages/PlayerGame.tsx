
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import { Button } from '@/components/ui/button';
import BingoCardDisplay from '@/components/game/BingoCardDisplay';
import BingoWinProgress from '@/components/game/BingoWinProgress';

export default function PlayerGame() {
  const { playerCode } = useParams<{ playerCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Inside the component where we destructure usePlayerGame()
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

  // Map the generic names to game-specific names for backwards compatibility
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
          <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
            {tickets.map((ticket: any) => (
              <div key={ticket.id} className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5.5a2.5 2.5 0 012.5 2.5V19a2.5 2.5 0 01-2.5 2.5H3.055a2.5 2.5 0 01-2.5-2.5V13.5a2.5 2.5 0 012.5-2.5zM8.555 11H11a2.5 2.5 0 012.5 2.5V19a2.5 2.5 0 01-2.5 2.5H8.555a2.5 2.5 0 01-2.5-2.5V13.5a2.5 2.5 0 012.5-2.5zM14.055 11H16.5a2.5 2.5 0 012.5 2.5V19a2.5 2.5 0 01-2.5 2.5H14.055a2.5 2.5 0 01-2.5-2.5V13.5a2.5 2.5 0 012.5-2.5z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Ticket #{ticket.ticket_number}</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  <BingoCardDisplay
                    numbers={ticket.numbers}
                    layoutMask={ticket.layout_mask}
                    calledNumbers={calledNumbers}
                    autoMarking={autoMarking}
                  />
                  <div className="mt-2">
                    {activeWinPatterns.map(pattern => (
                      <div key={pattern} className="mb-1">
                        <span className="font-medium">{pattern}:</span>
                        <BingoWinProgress
                          numbers={ticket.numbers}
                          layoutMask={ticket.layout_mask}
                          calledNumbers={calledNumbers}
                          activeWinPatterns={activeWinPatterns}
                          currentWinPattern={pattern}
                          gameType={gameType}
                        />
                      </div>
                    ))}
                  </div>
                </dd>
              </div>
            ))}
          </dl>
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
