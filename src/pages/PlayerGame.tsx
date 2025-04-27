
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlayerGame } from '@/hooks/usePlayerGame';
import GameTypePlayspace from '@/components/game/GameTypePlayspace';
import PlayerGameLoader from '@/components/game/PlayerGameLoader';
import PlayerGameLayout from '@/components/game/PlayerGameLayout';
import { WIN_PATTERNS } from '@/types/winPattern';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { PrizeDetails } from '@/types';

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

  useEffect(() => {
    if (claimStatus === 'validated' || claimStatus === 'rejected') {
      const timer = setTimeout(() => {
        console.log(`Auto-resetting claim status from ${claimStatus} state after timeout`);
        resetClaimStatus();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [claimStatus, resetClaimStatus]);

  useEffect(() => {
    if (!playerCode || !currentSession?.id) return;
    
    console.log("Setting up broadcast channel for player claim updates");
    
    const broadcastChannel = supabase.channel('player-game-updates')
      .on('broadcast', { event: 'claim-update' }, (payload) => {
        console.log("Received claim update broadcast:", payload);
        if (payload.payload && payload.payload.sessionId === currentSession.id) {
          console.log("Refreshing game state due to claim update");
          
          // Force a refresh of the player game data to get the latest state
          setAutoMarking(prev => !prev);
          setTimeout(() => setAutoMarking(prev => !prev), 50);
          
          // If we receive a valid claim result and we're currently claiming, reset our claim status
          if ((payload.payload.result === 'valid' || payload.payload.result === 'false') && isClaiming) {
            console.log(`Resetting claim status due to ${payload.payload.result} broadcast result`);
            resetClaimStatus();
            
            if (payload.payload.result === 'valid') {
              toast({
                title: "Claim Verified",
                description: "Your bingo claim has been verified!",
                variant: "default"
              });
            } else if (payload.payload.result === 'false') {
              toast({
                title: "Claim Rejected", 
                description: "Your claim was not valid. Please check your card.",
                variant: "destructive"
              });
            }
          }
        }
      })
      .subscribe();
      
    return () => {
      console.log("Cleaning up broadcast channel");
      supabase.removeChannel(broadcastChannel);
    };
  }, [playerCode, currentSession?.id, isClaiming, resetClaimStatus, toast, setAutoMarking]);

  useEffect(() => {
    if (!currentSession?.id) return;
    
    console.log("Setting up direct realtime subscription for game session");
    
    const channel = supabase
      .channel(`player-game-session-${currentSession.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${currentSession.id}`
        },
        (payload) => {
          console.log("Received direct database update:", payload);
          
          // Force a refresh to get the latest session state
          if (payload.new && JSON.stringify(payload.new) !== JSON.stringify(payload.old)) {
            console.log("Database change detected, refreshing game state");
            setAutoMarking(prev => !prev);
            setTimeout(() => setAutoMarking(prev => !prev), 50);
          }
        }
      )
      .subscribe();
      
    return () => {
      console.log("Removing database subscription");
      supabase.removeChannel(channel);
    };
  }, [currentSession?.id, setAutoMarking]);

  const isInitialLoading = isLoading && loadingStep !== 'completed';
  const hasTickets = tickets && tickets.length > 0;
  const isGameActive = currentGameState?.status === 'active';
  const hasSession = !!currentSession;
  
  const shouldShowLoader = 
    (isInitialLoading && loadingStep !== 'completed') || 
    !!errorMessage || 
    !hasSession || 
    (!currentGameState && loadingStep !== 'completed') ||
    (!isGameActive && !hasTickets && loadingStep !== 'completed');

  useEffect(() => {
    if (hasSession && hasTickets && isGameActive && loadingStep === 'completed') {
      console.log('Game fully loaded, stable state reached');
    }
  }, [hasSession, hasTickets, isGameActive, loadingStep]);

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

  const getWinPatternName = (patternId: string) => {
    const displayPatternId = patternId.replace('MAINSTAGE_', '');
    
    const allPatterns = gameType ? WIN_PATTERNS[gameType] : [];
    const pattern = allPatterns.find(p => p.id === displayPatternId);
    
    if (displayPatternId === 'oneLine') return 'One Line';
    if (displayPatternId === 'twoLines') return 'Two Lines';
    if (displayPatternId === 'fullHouse') return 'Full House';
    
    return pattern ? pattern.name : patternId;
  };

  useEffect(() => {
    console.log('Player Game Render State:', {
      isLoading,
      loadingStep,
      hasSession,
      isGameActive: currentGameState?.status,
      hasTickets: tickets?.length,
      shouldShowLoader,
      isClaiming,
      claimStatus,
      activeWinPatterns
    });
  }, [isLoading, loadingStep, currentSession, currentGameState, tickets, shouldShowLoader, isClaiming, claimStatus, activeWinPatterns]);

  const { progress: sessionProgress } = useSessionProgress(currentSession?.id);

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

  const currentWinPattern = activeWinPatterns.length > 0 ? activeWinPatterns[0] : null;

  // Convert complex prize objects to strings for the layout component
  const simplifiedPrizes: { [key: string]: string } = {};
  if (winPrizes) {
    Object.entries(winPrizes).forEach(([key, prize]) => {
      if (typeof prize === 'string') {
        simplifiedPrizes[key] = prize;
      } else if (prize && typeof prize === 'object') {
        const prizeDetail = prize as PrizeDetails;
        simplifiedPrizes[key] = prizeDetail.amount || prizeDetail.description || 'Prize';
      }
    });
  }

  return (
    <PlayerGameLayout
      tickets={tickets || []}
      calledNumbers={calledItems || []}
      currentNumber={lastCalledItem}
      currentSession={currentSession}
      autoMarking={autoMarking}
      setAutoMarking={setAutoMarking}
      playerCode={playerCode || ''}
      winPrizes={simplifiedPrizes}
      activeWinPatterns={activeWinPatterns || []}
      currentWinPattern={currentWinPattern}
      onClaimBingo={handleClaimBingo}
      errorMessage={errorMessage || ''}
      isLoading={isLoading}
      isClaiming={isClaiming}
      claimStatus={claimStatus}
      gameType={gameType || 'mainstage'}
      currentGameNumber={sessionProgress?.current_game_number || 1}
      numberOfGames={sessionProgress?.max_game_number || 1}
    >
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
    </PlayerGameLayout>
  );
}
