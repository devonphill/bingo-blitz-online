
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession } from '@/types';
import { WinPattern } from '@/types/winPattern';
import BingoCard from '@/components/caller/BingoCard';
import { WinPatternSelector } from '@/components/caller/WinPatternSelector';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, UserPlus } from 'lucide-react';

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
      // Map database fields to GameSession interface properties
      const sessionData: GameSession = {
        id: data.id,
        name: data.name,
        gameType: data.game_type as any,
        createdBy: data.created_by,
        accessCode: data.access_code,
        status: data.status,
        createdAt: data.created_at,
        sessionDate: data.session_date,
        numberOfGames: data.number_of_games,
        current_game_state: data.current_game_state
      };
      
      setSession(sessionData);
      
      // Set called numbers if they exist in the current game state
      if (data.current_game_state?.calledItems) {
        setCalledNumbers(data.current_game_state.calledItems);
      }
      
      // Set current number if it exists
      if (data.current_game_state?.lastCalledItem) {
        setCurrentNumber(data.current_game_state.lastCalledItem);
      }
    }
  }, [sessionId]);

  // Since the win_patterns table has been removed per migration info, we'll 
  // use the patterns from the game rules based on current game type
  const fetchWinPatterns = useCallback(async () => {
    // For now, this is a stub as we'll get patterns from the WinPatternSelector component
    // which uses getGameRulesForType to fetch appropriate patterns
    setWinPatterns([]);
  }, []);

  useEffect(() => {
    fetchSession();
    fetchWinPatterns();
  }, [fetchSession, fetchWinPatterns]);

  const callNumber = async () => {
    if (!session) return;
    
    // Using 75 as default if numberRange is not available
    const numberRange = session.current_game_state?.gameType === '90-ball' ? 90 : 75;
    const newNumber = Math.floor(Math.random() * numberRange) + 1;
    
    if (calledNumbers.includes(newNumber)) {
      // Number already called, try again
      callNumber();
      return;
    }

    setCurrentNumber(newNumber);
    const updatedCalledNumbers = [...calledNumbers, newNumber];
    setCalledNumbers(updatedCalledNumbers);

    // Update the current game state
    if (session.current_game_state) {
      const updatedGameState = {
        ...session.current_game_state,
        calledItems: updatedCalledNumbers,
        lastCalledItem: newNumber
      };

      // Optimistically update the UI
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
        // Revert the UI update on error
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

    // Update the current game state
    const updatedGameState = {
      ...session.current_game_state,
      calledItems: [],
      lastCalledItem: null
    };

    // Optimistically update the UI
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
      // Revert the UI update on error
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

    // Use bingo_claims table instead of player_claims
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

  // Determine number range based on game type
  const getNumberRange = () => {
    if (!session) return 75; // Default to 75
    
    if (session.current_game_state?.gameType === '90-ball') {
      return 90;
    }
    
    return 75; // Default for most game types
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
            <Button variant="outline" onClick={callNumber}>Call Number</Button>
            <Button variant="destructive" onClick={resetNumbers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset Numbers
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Current Number</h2>
          <div className="text-6xl font-extrabold text-bingo-primary">{currentNumber || '-'}</div>
          <p className="text-gray-600">
            Called numbers: {calledNumbers.join(', ') || 'None'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BingoCard numbers={calledNumbers} numberRange={getNumberRange()} />
        </div>

        <WinPatternSelector />
      </main>
    </div>
  );
}
