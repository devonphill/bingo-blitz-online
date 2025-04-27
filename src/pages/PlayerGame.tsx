
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import CurrentNumberDisplay from '@/components/game/CurrentNumberDisplay';
import { WIN_PATTERNS } from '@/types/winPattern';
import { Badge } from '@/components/ui/badge';

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
    winPrizes,
    autoMarking,
    setAutoMarking,
    isLoading,
    errorMessage,
    handleClaimBingo,
    isClaiming,
    claimStatus,
    gameType,
    loadingStep,
    resetClaimStatus,
  } = usePlayerGame(playerCode);

  // Reset claim status when user has been validated or rejected after 5s
  useEffect(() => {
    if (claimStatus === 'validated' || claimStatus === 'rejected') {
      const timer = setTimeout(() => {
        resetClaimStatus();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [claimStatus, resetClaimStatus]);

  // IMPROVED: Refined loading logic to fix flickering issues
  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const isGameActive = currentGameState?.status === 'active';
  const hasSession = !!currentSession;
  
  // IMPROVED: More stable condition to prevent flickering between loaded and loading states
  const shouldShowLoader = 
    (isInitialLoading && loadingStep !== 'completed') || 
    !!errorMessage || 
    !hasSession || 
    (!currentGameState && loadingStep !== 'completed') ||
    (!isGameActive && !hasTickets && loadingStep !== 'completed');

  // Once we have successfully loaded all data, we should not show the loader again
  // This prevents flickering when real-time updates are received
  useEffect(() => {
    if (hasSession && hasTickets && isGameActive && loadingStep === 'completed') {
      console.log('Game fully loaded, stable state reached');
    }
  }, [hasSession, hasTickets, isGameActive, loadingStep]);

  // Get display name for game type
  const getGameTypeDisplayName = () => {
    switch (gameType) {
      case 'mainstage': return 'Mainstage Bingo';
      case 'party': return 'Party Bingo';
      case 'quiz': return 'Quiz Bingo';
      case 'music': return 'Music Bingo';
      case 'logo': return 'Logo Bingo';
      default: return gameType ? `${gameType} Bingo` : 'Bingo Game';
    }
  };

  // Get formatted win pattern name
  const getWinPatternName = (patternId: string) => {
    const allPatterns = gameType ? WIN_PATTERNS[gameType] : [];
    const pattern = allPatterns.find(p => p.id === patternId);
    return pattern ? pattern.name : patternId;
  };

  // Log some debug information to help diagnose the flickering issue
  useEffect(() => {
    console.log('Player Game Render State:', {
      isLoading,
      loadingStep,
      hasSession,
      isGameActive: currentGameState?.status,
      hasTickets: tickets?.length,
      shouldShowLoader,
      isClaiming,
      claimStatus
    });
  }, [isLoading, loadingStep, currentSession, currentGameState, tickets, shouldShowLoader, isClaiming, claimStatus]);

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
          
          {/* Game Type Display */}
          <div className="mb-6 p-3 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-medium mb-2">Game Type</h2>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-gray-700 text-white border-gray-600">
                {getGameTypeDisplayName()}
              </Badge>
            </div>
          </div>
          
          {/* Active Win Patterns Display */}
          {activeWinPatterns && activeWinPatterns.length > 0 && (
            <div className="mb-6 p-3 bg-gray-800 rounded-lg">
              <h2 className="text-lg font-medium mb-2">Active Win Patterns</h2>
              <div className="flex flex-wrap gap-2">
                {activeWinPatterns.map(patternId => (
                  <Badge 
                    key={patternId}
                    className="bg-bingo-primary text-white"
                  >
                    {getWinPatternName(patternId)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Claim Bingo Button */}
          <button
            onClick={handleClaimBingo}
            disabled={isClaiming || claimStatus === 'validated'}
            className={`w-full py-3 px-4 rounded-lg font-medium mt-2 ${
              isClaiming || claimStatus === 'pending' 
                ? 'bg-yellow-500 text-white' 
                : claimStatus === 'validated'
                  ? 'bg-green-500 text-white'
                  : claimStatus === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-bingo-primary text-white hover:bg-bingo-secondary'
            }`}
          >
            {isClaiming || claimStatus === 'pending' 
              ? 'Verifying Claim...'
              : claimStatus === 'validated'
                ? 'Win Verified!'
                : claimStatus === 'rejected'
                  ? 'Claim Rejected'
                  : 'CLAIM BINGO!'}
          </button>
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
