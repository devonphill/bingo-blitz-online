
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, CurrentGameState } from '@/types';
import { GameType, WIN_PATTERNS, WinPattern } from '@/types/winPattern';
import { GameTypeSelector } from '@/components/caller/GameTypeSelector';
import { CallControls } from '@/components/caller/CallControls';
import BingoCard from '@/components/caller/BingoCard';
import { WinPatternSelector } from '@/components/caller/WinPatternSelector';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, UserPlus, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { helpers } from '@/integrations/supabase/customTypes';

// Add missing Json type reference
type Json = helpers.Json;

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentGameType, setCurrentGameType] = useState<GameType>('mainstage');
  const [winPatterns, setWinPatterns] = useState<WinPattern[]>(WIN_PATTERNS.mainstage);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const { toast } = useToast();

  // Define fetchWinPatterns before using it
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

  const resetNumbers = async () => {
    if (!session?.current_game_state) return;
    
    setCurrentNumber(null);
    setCalledNumbers([]);

    const updatedGameState = {
      ...session.current_game_state,
      calledItems: [],
      lastCalledItem: null
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
      console.error("Error resetting numbers:", error);
      toast({
        title: "Error resetting numbers",
        description: "Failed to reset the numbers. Please try again.",
        variant: "destructive",
      });
      fetchSession();
    } else {
      toast({
        title: "Numbers reset",
        description: "The called numbers have been reset.",
      });
    }
  };

  const handlePatternSelect = (pattern: WinPattern) => {
    // setCurrentPattern(pattern);
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

  useEffect(() => {
    if (sessionId && session?.id) {
      console.log("Initial check for pending claims");
      const timer = setTimeout(() => {
        checkForClaims();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId, session?.id]);

  const handleAddPlayers = () => {
    if (session) {
      navigator.clipboard.writeText(session.accessCode);
      toast({
        title: "Access code copied",
        description: "Share this code with your players!",
      });
    }
  };

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

  const getNumberRange = () => {
    return currentGameType === 'mainstage' ? 90 : 75;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6 space-y-6">
      <GameTypeSelector
        currentGameType={currentGameType}
        onGameTypeChange={handleGameTypeChange}
      />
      
      <WinPatternSelector 
        patterns={winPatterns}
        selectedPatterns={session?.current_game_state?.activePatternIds || []}
        onPatternSelect={handlePatternSelect}
      />
      
      <div className="grid grid-cols-2 gap-6">
        <CallControls
          gameType={currentGameType}
          onCallNumber={callNumber}
          onRecall={() => setCurrentNumber(calledNumbers[calledNumbers.length - 1])}
          lastCalledNumber={currentNumber}
          totalCalls={calledNumbers.length}
          pendingClaims={pendingClaims.length}
          onViewClaims={checkForClaims}
        />
        
        <BingoCard
          numbers={calledNumbers}
          numberRange={getNumberRange()}
        />
      </div>
    </div>
  );
}
