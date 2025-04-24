import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType, CurrentGameState } from '@/types';
import { WinPattern } from '@/types/winPattern';
import BingoCard from '@/components/caller/BingoCard';
import { WinPatternSelector } from '@/components/caller/WinPatternSelector';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, UserPlus, Play } from 'lucide-react';
import { GameTypeChanger } from '@/components/game/GameTypeChanger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [winPatterns, setWinPatterns] = useState<WinPattern[]>([]);
  const [currentPattern, setCurrentPattern] = useState<WinPattern | null>(null);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const { toast } = useToast();

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
        gameType: 'mainstage',
        activePatternIds: [],
        calledItems: [],
        lastCalledItem: null,
        status: 'pending',
        prizes: {}
      };

      const sessionData: GameSession = {
        id: data.id,
        name: data.name,
        gameType: data.game_type as GameType || 'mainstage',
        createdBy: data.created_by,
        accessCode: data.access_code,
        status: data.status as "pending" | "active" | "completed",
        createdAt: data.created_at,
        sessionDate: data.session_date,
        numberOfGames: data.number_of_games,
        current_game_state: (data.current_game_state as CurrentGameState) || initialGameState
      };
      
      setSession(sessionData);
      
      if (sessionData.current_game_state?.calledItems) {
        setCalledNumbers(sessionData.current_game_state.calledItems as number[]);
      }
      
      if (sessionData.current_game_state?.lastCalledItem) {
        setCurrentNumber(sessionData.current_game_state.lastCalledItem as number);
      }
    }
  }, [sessionId]);

  const fetchWinPatterns = useCallback(async () => {
    setWinPatterns([]);
  }, []);

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
        .update({ current_game_state: updatedGameState })
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
      .update({ current_game_state: updatedGameState })
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
    setCurrentPattern(pattern);
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

  const getNumberRange = () => {
    const gameType = session?.current_game_state?.gameType || 'mainstage';
    return gameType === 'mainstage' ? 90 : 75;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-bingo-primary">Caller Session</h1>
          <div className="flex items-center space-x-4">
            <Button onClick={handleAddPlayers}>
              <UserPlus className="mr-2 h-4 w-4" />
              Copy Access Code
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Game Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <Button onClick={callNumber} className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                Call Number
              </Button>
              <Button variant="destructive" onClick={resetNumbers} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Numbers
              </Button>
            </div>
            
            <div className="text-center">
              <div className="text-6xl font-bold text-bingo-primary mb-2">
                {currentNumber || '-'}
              </div>
              <p className="text-gray-600">
                Called numbers: {calledNumbers.length > 0 ? calledNumbers.join(', ') : 'None'}
              </p>
            </div>
          </CardContent>
        </Card>

        <GameTypeChanger />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BingoCard numbers={calledNumbers} numberRange={getNumberRange()} />
          <WinPatternSelector />
        </div>
      </main>
    </div>
  );
}
