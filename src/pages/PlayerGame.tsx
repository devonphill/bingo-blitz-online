
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import BingoWinProgress from '@/components/game/BingoWinProgress';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import CurrentNumberDisplay from '@/components/game/CurrentNumberDisplay';

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
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Panel */}
      <div className="flex flex-col" style={{width:'30%', minWidth:240, maxWidth:400}}>
        <div className="flex-1 bg-black text-white p-4">
          <h1 className="text-xl font-bold mb-4">
            {currentSession?.name || "Bingo Game"}
          </h1>
          <div className="text-sm text-gray-300 mb-4">
            Welcome, {playerName || "Player"}
          </div>
          
          {activeWinPatterns && activeWinPatterns.length > 0 && (
            <div className="mb-4">
              <BingoWinProgress 
                activeWinPatterns={activeWinPatterns}
                handleClaimBingo={handleClaimBingo}
                isClaiming={isClaiming}
                claimStatus={claimStatus}
                gameType={gameType || "mainstage"}
              />
            </div>
          )}
        </div>
        
        <div className="bg-black text-white p-4 border-t border-gray-700 sticky bottom-0" style={{ height: '30vw', maxHeight: '400px' }}>
          <CurrentNumberDisplay 
            number={lastCalledItem} 
            sizePx={Math.min(window.innerWidth * 0.25, 350)}
            gameType={gameType}
          />
          <div className="text-xs text-gray-400 mt-2 text-center">
            {calledItems?.length || 0} numbers called
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
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
    </div>
  );
}
