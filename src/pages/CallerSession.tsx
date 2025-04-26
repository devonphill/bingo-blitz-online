import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType, CurrentGameState } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameSetupView } from '@/components/caller/GameSetupView';
import { LiveGameView } from '@/components/caller/LiveGameView';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentGameType, setCurrentGameType] = useState<GameType>('mainstage');
  const [winPatterns, setWinPatterns] = useState<WinPattern[]>(WIN_PATTERNS.mainstage);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchWinPatterns = useCallback(async () => {
    setWinPatterns(WIN_PATTERNS[currentGameType] || []);
  }, [currentGameType]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error("Error fetching session:", error);
    } else if (data) {
      const initialGameState: CurrentGameState = {
        gameNumber: 1,
        gameType: (data.game_type as GameType) || 'mainstage',
        activePatternIds: [],
        calledItems: [],
        lastCalledItem: null,
        status: 'pending',
        prizes: {}
      };

      const gameState = data.current_game_state 
        ? (data.current_game_state as unknown as CurrentGameState)
        : initialGameState;

      setSession({
        id: data.id,
        name: data.name,
        gameType: data.game_type as GameType || 'mainstage',
        createdBy: data.created_by,
        accessCode: data.access_code,
        status: data.status as "pending" | "active" | "completed",
        createdAt: data.created_at,
        sessionDate: data.session_date,
        numberOfGames: data.number_of_games,
        current_game_state: gameState
      });

      setCurrentGameType(gameState.gameType);
      setCalledNumbers(gameState.calledItems as number[]);
      setCurrentNumber(gameState.lastCalledItem as number);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    fetchWinPatterns();
  }, [fetchSession, fetchWinPatterns]);

  const handleGameTypeChange = async (newType: GameType) => {
    if (!session) return;
    
    const updatedGameState: CurrentGameState = {
      ...session.current_game_state,
      gameType: newType,
      calledItems: [],
      lastCalledItem: null,
      activePatternIds: []
    };

    const { error } = await supabase
      .from('game_sessions')
      .update({
        game_type: newType,
        current_game_state: updatedGameState as unknown as Json
      })
      .eq('id', sessionId);

    if (error) {
      console.error("Error updating game type:", error);
      toast({
        title: "Error changing game type",
        description: "Failed to update the game type. Please try again.",
        variant: "destructive",
      });
    } else {
      setCurrentGameType(newType);
      setWinPatterns(WIN_PATTERNS[newType]);
      setCalledNumbers([]);
      setCurrentNumber(null);
      toast({
        title: "Game type updated",
        description: `Changed to ${newType} Bingo`,
      });
    }
  };

  const handlePatternSelect = (pattern: WinPattern) => {
    if (!session?.current_game_state) return;
    
    const selectedPatterns = [...(session.current_game_state.activePatternIds || [])];
    const patternIndex = selectedPatterns.indexOf(pattern.id);
    
    if (patternIndex >= 0) {
      selectedPatterns.splice(patternIndex, 1);
    } else {
      selectedPatterns.push(pattern.id);
    }
    
    const updatedGameState = {
      ...session.current_game_state,
      activePatternIds: selectedPatterns
    };
    
    setSession(prevSession => prevSession ? {
      ...prevSession,
      current_game_state: updatedGameState
    } : null);
    
    supabase
      .from('game_sessions')
      .update({ current_game_state: updatedGameState as unknown as Json })
      .eq('id', sessionId)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating win patterns:", error);
          toast({
            title: "Error updating win patterns",
            description: "Failed to update the win patterns. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: pattern.id + (patternIndex >= 0 ? " removed" : " selected"),
            description: `Win pattern ${patternIndex >= 0 ? "removed from" : "added to"} the game.`,
          });
        }
      });
  };

  const handleGoLive = async () => {
    if (!session || !session.current_game_state?.activePatternIds?.length) {
      toast({
        title: "Cannot start game",
        description: "Please select at least one win pattern before starting the game.",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('game_sessions')
      .update({ 
        lifecycle_state: 'live',
        current_game_state: {
          ...session.current_game_state,
          status: 'active'
        }
      })
      .eq('id', sessionId);

    if (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Game Started",
        description: "The game is now live!",
      });
    }
  };

  const callNumber = async () => {
    if (!session) return;
    
    const gameType = session.current_game_state?.gameType || 'mainstage';
    const numberRange = gameType === 'mainstage' ? 90 : 75;
    const newNumber = Math.floor(Math.random() * numberRange) + 1;
    
    if (calledNumbers.includes(newNumber)) {
      callNumber();
      return;
    }

    setCurrentNumber(newNumber);
    const updatedCalledNumbers = [...calledNumbers, newNumber];
    setCalledNumbers(updatedCalledNumbers);

    if (session.current_game_state) {
      const updatedGameState: CurrentGameState = {
        ...session.current_game_state,
        calledItems: updatedCalledNumbers,
        lastCalledItem: newNumber
      };

      setSession(prevSession => prevSession ? {
        ...prevSession,
        current_game_state: updatedGameState
      } : null);

      const { error } = await supabase
        .from('game_sessions')
        .update({ current_game_state: updatedGameState as unknown as Json })
        .eq('id', sessionId);

      if (error) {
        console.error("Error updating called numbers:", error);
        toast({
          title: "Error calling number",
          description: "Failed to update the called number. Please try again.",
          variant: "destructive",
        });
        fetchSession();
      } else {
        toast({
          title: "Number called",
          description: `The number ${newNumber} has been called.`,
        });
      }
    }
  };

  const checkForClaims = async () => {
    if (!sessionId) return;

    const { data: claims, error } = await supabase
      .from('bingo_claims')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'pending');

    if (error) {
      console.error("Error fetching pending claims:", error);
      toast({
        title: "Error checking claims",
        description: "Failed to check for pending claims. Please try again.",
        variant: "destructive",
      });
    } else {
      setPendingClaims(claims);
      if (claims && claims.length > 0) {
        toast({
          title: "New claims!",
          description: `There are ${claims.length} new claims to review.`,
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {session?.lifecycle_state === 'setup' ? (
        <GameSetupView
          currentGameType={currentGameType}
          onGameTypeChange={handleGameTypeChange}
          winPatterns={winPatterns}
          selectedPatterns={session?.current_game_state?.activePatternIds || []}
          onPatternSelect={handlePatternSelect}
          onGoLive={handleGoLive}
          isGoingLive={false}
        />
      ) : session?.lifecycle_state === 'live' ? (
        <LiveGameView
          gameType={currentGameType}
          winPatterns={winPatterns}
          selectedPatterns={session?.current_game_state?.activePatternIds || []}
          currentWinPattern={session?.current_game_state?.activePatternIds?.[0] || null}
          onCallNumber={callNumber}
          onRecall={() => setCurrentNumber(calledNumbers[calledNumbers.length - 1])}
          lastCalledNumber={currentNumber}
          calledNumbers={calledNumbers}
          pendingClaims={pendingClaims.length}
          onViewClaims={checkForClaims}
        />
      ) : (
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg text-gray-500">Session has ended</p>
        </div>
      )}
    </div>
  );
}
