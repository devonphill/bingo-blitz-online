import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import BingoWinProgress from '@/components/game/BingoWinProgress';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';

export default function PlayerGame() {
  const { playerCode: urlPlayerCode } = useParams<{ playerCode: string }>();
  const [playerCode, setPlayerCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    
    if (urlPlayerCode) {
      setPlayerCode(urlPlayerCode);
      localStorage.setItem('playerCode', urlPlayerCode);
    } else if (storedPlayerCode) {
      setPlayerCode(storedPlayerCode);
    } else {
      toast({
        title: 'Player Code Missing',
        description: 'Please enter your player code to join the game.',
        variant: 'destructive'
      });
      navigate('/join');
    }
  }, []);

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
    loadingStep,
  } = usePlayerGame(playerCode);

  const shouldShowLoader = isLoading || 
    errorMessage || 
    !currentSession || 
    !currentGameState || 
    currentGameState.status !== 'active';

  if (shouldShowLoader) {
    return (
      <PlayerGameLoader 
        isLoading={isLoading} 
        errorMessage={errorMessage} 
        currentSession={currentSession}
        loadingStep={loadingStep}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-center text-bingo-dark">
            {currentSession.name || "Bingo Game"}
          </h1>
          <div className="text-center text-gray-500 mt-2">
            Welcome, {playerName || "Player"}
          </div>
        </header>

        {activeWinPatterns && activeWinPatterns.length > 0 && (
          <div className="mb-6">
            <BingoWinProgress 
              activeWinPatterns={activeWinPatterns}
              handleClaimBingo={handleClaimBingo}
              isClaiming={isClaiming}
              claimStatus={claimStatus}
              gameType={gameType || "mainstage"}
            />
          </div>
        )}

        <GameTypePlayspace
          gameType={gameType || "mainstage"}
          tickets={tickets || []}
          calledNumbers={calledItems || []}
          lastCalledNumber={lastCalledItem}
          autoMarking={autoMarking}
          setAutoMarking={setAutoMarking}
          handleClaimBingo={handleClaimBingo}
          isClaiming={isClaiming}
          claimStatus={claimStatus}
        />
      </div>
    </div>
  );
}
