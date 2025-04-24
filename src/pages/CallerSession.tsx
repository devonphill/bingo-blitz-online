import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, WinPattern } from '@/types';
import BingoCard from '@/components/caller/BingoCard';
import WinPatternSelector from '@/components/caller/WinPatternSelector';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast"
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
    } else {
      setSession(data);
    }
  }, [sessionId]);

  const fetchWinPatterns = useCallback(async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
      .from('win_patterns')
      .select('*')
      .eq('game_session_id', sessionId);

    if (error) {
      console.error("Error fetching win patterns:", error);
    } else {
      setWinPatterns(data);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    fetchWinPatterns();
  }, [fetchSession, fetchWinPatterns]);

  const callNumber = async () => {
    if (!session) return;

    const newNumber = Math.floor(Math.random() * session.numberRange) + 1;
    if (calledNumbers.includes(newNumber)) {
      // Number already called, try again
      callNumber();
      return;
    }

    setCurrentNumber(newNumber);
    setCalledNumbers([...calledNumbers, newNumber]);

    // Optimistically update the UI
    setSession(prevSession => ({
      ...prevSession!,
      calledNumbers: [...calledNumbers, newNumber]
    }));

    const { error } = await supabase
      .from('game_sessions')
      .update({ calledNumbers: [...calledNumbers, newNumber] })
      .eq('id', sessionId);

    if (error) {
      console.error("Error updating called numbers:", error);
      toast({
        title: "Error calling number",
        description: "Failed to update the called number. Please try again.",
        variant: "destructive",
      });
      // Revert the UI update on error
      setSession(prevSession => ({
        ...prevSession!,
        calledNumbers: calledNumbers
      }));
    } else {
      toast({
        title: "Number called",
        description: `The number ${newNumber} has been called.`,
      });
    }
  };

  const resetNumbers = async () => {
    setCurrentNumber(null);
    setCalledNumbers([]);

    // Optimistically update the UI
    setSession(prevSession => ({
      ...prevSession!,
      calledNumbers: []
    }));

    const { error } = await supabase
      .from('game_sessions')
      .update({ calledNumbers: [] })
      .eq('id', sessionId);

    if (error) {
      console.error("Error resetting numbers:", error);
      toast({
        title: "Error resetting numbers",
        description: "Failed to reset the numbers. Please try again.",
        variant: "destructive",
      });
      // Revert the UI update on error
      setSession(prevSession => ({
        ...prevSession!,
        calledNumbers: calledNumbers
      }));
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
      .from('player_claims')
      .select('*')
      .eq('game_session_id', sessionId)
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
  }, [sessionId, session?.id, checkForClaims]);

  const handleAddPlayers = () => {
    if (session) {
      navigator.clipboard.writeText(session.accessCode);
      toast({
        title: "Access code copied",
        description: "Share this code with your players!",
      });
    }
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
          <BingoCard numbers={calledNumbers} numberRange={session?.numberRange || 75} />
        </div>

        <WinPatternSelector
          onPatternSelect={handlePatternSelect}
          currentPattern={currentPattern}
        />
      </main>
    </div>
  );
}
