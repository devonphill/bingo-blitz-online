import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameType, GameConfig } from '@/types';
import { WinPattern } from '@/types/winPattern';
import { WinPatternConfig } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GameTypeSelector } from '@/components/caller/GameTypeSelector';
import { WinPatternSelector } from '@/components/caller/WinPatternSelector';
import { LiveGameView } from '@/components/caller/LiveGameView';
import { SessionProgressUpdate } from '@/utils/callerSessionHelper';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { SessionProgress } from '@/hooks/useSessionProgress';
import { jsonToGameConfigs } from '@/utils/jsonUtils';

export default function CallerSession() {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<{
    id: string;
    name: string;
    gameType: GameType;
    createdBy: string;
    accessCode: string;
    status: string;
    createdAt: string;
    sessionDate?: string;
    numberOfGames: number;
    current_game: number;
    lifecycle_state: string;
    games_config: GameConfig[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameType, setGameType] = useState<GameType>('mainstage');
  const [availablePatterns, setAvailablePatterns] = useState<WinPattern[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [isClaimSheetOpen, setIsClaimSheetOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>('pending');
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [currentGameNumber, setCurrentGameNumber] = useState(1);
  const [numberOfGames, setNumberOfGames] = useState(1);
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);

  const gameRules = getGameRulesForType(gameType);

  // Fetch session data on component mount
  useEffect(() => {
    async function fetchSessionData() {
      if (!urlSessionId) {
        setError('Session ID is missing.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', urlSessionId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const parsedConfigs = jsonToGameConfigs(data.games_config);
          
          setSession({
            id: data.id,
            name: data.name,
            gameType: data.game_type as GameType,
            createdBy: data.created_by,
            accessCode: data.access_code,
            status: data.status as string,
            createdAt: data.created_at,
            sessionDate: data.session_date,
            numberOfGames: data.number_of_games,
            current_game: data.current_game,
            lifecycle_state: data.lifecycle_state as string,
            games_config: parsedConfigs
          });
          setGameType(data.game_type as GameType);
          setSessionStatus(data.status as string);
          setGameConfigs(parsedConfigs);
          setCurrentGameNumber(data.current_game || 1);
          setNumberOfGames(data.number_of_games || 1);
        }
      } catch (err) {
        setError(`Failed to fetch session: ${(err as Error).message}`);
        console.error('Error fetching session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessionData();
  }, [urlSessionId]);

  useEffect(() => {
    if (gameRules) {
      const patterns = gameRules.getWinPatterns().map(p => ({
        id: p.id,
        name: p.name,
        gameType: p.gameType,
        available: p.available
      } as WinPattern));
      setAvailablePatterns(patterns);
    }
  }, [gameRules]);

  // Fetch session progress
  const { progress, loading: progressLoading, error: progressError } = useSessionProgress(urlSessionId);

  useEffect(() => {
    if (progress) {
      setCalledNumbers(progress.called_numbers || []);
      setCurrentWinPattern(progress.current_win_pattern);
    }
  }, [progress]);

  // Update session progress in the database
  const updateSessionProgress = async (sessionId: string, updates: SessionProgressUpdate): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('sessions_progress')
        .update(updates)
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error updating session progress:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Exception updating session progress:', err);
      return false;
    }
  };

  const handleGameTypeChange = (newType: GameType) => {
    setGameType(newType);
    if (gameRules) {
      const patterns = gameRules.getWinPatterns().map(p => ({
        id: p.id,
        name: p.name,
        gameType: p.gameType,
        available: p.available
      } as WinPattern));
      setAvailablePatterns(patterns);
    }
    setSelectedPatterns([]);
  };

  const handlePatternSelect = (pattern: WinPattern) => {
    setSelectedPatterns(prev => {
      if (prev.includes(pattern.id)) {
        return prev.filter(id => id !== pattern.id);
      } else {
        return [...prev, pattern.id];
      }
    });
  };

  const handleGenerateNewNumber = () => {
    if (!gameRules || calledNumbers.length >= 90) return;

    try {
      const newNumber = gameRules.generateNewNumber(calledNumbers);
      setCalledNumbers(prev => [...prev, newNumber]);
      setLastCalledNumber(newNumber);

      // Update session progress with the new number
      if (session) {
        updateSessionProgress(session.id, {
          called_numbers: [...calledNumbers, newNumber]
        });
      }
    } catch (error) {
      console.error("Error generating new number:", error);
      toast({
        title: "Error",
        description: "Failed to generate a new number. All possible numbers may have been called.",
        variant: "destructive"
      });
    }
  };

  const handleRecallNumber = () => {
    if (calledNumbers.length === 0) return;

    const recalledNumber = calledNumbers[calledNumbers.length - 1];
    setCalledNumbers(prev => prev.slice(0, -1));
    setLastCalledNumber(recalledNumber);

    // Update session progress by removing the last called number
    if (session) {
      updateSessionProgress(session.id, {
        called_numbers: calledNumbers.slice(0, -1)
      });
    }
  };

  const handleViewClaims = () => {
    setIsClaimSheetOpen(true);
  };

  const handleCloseClaimSheet = () => {
    setIsClaimSheetOpen(false);
  };

  const handleGoLive = async () => {
    if (!session) return;

    try {
      // Update session status to 'active'
      const { error } = await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', session.id);

      if (error) {
        throw error;
      }

      setSessionStatus('active');

      // Update session progress with initial game state
      await updateSessionProgress(session.id, {
        game_status: 'active'
      });
    } catch (err) {
      console.error('Error going live:', err);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleGameEnd = async () => {
    if (!session) return;

    try {
      // Update session status to 'completed'
      const { error } = await supabase
        .from('game_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      if (error) {
        throw error;
      }

      setSessionStatus('completed');

      await updateSessionProgress(session.id, {
        game_status: 'completed'
      });
    } catch (err) {
      console.error('Error ending game:', err);
      toast({
        title: "Error",
        description: "Failed to end the game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleNextGame = async () => {
    if (!session) return;

    try {
      // Increment current_game and update session
      const nextGameNumber = session.current_game + 1;
      const { error } = await supabase
        .from('game_sessions')
        .update({ current_game: nextGameNumber })
        .eq('id', session.id);

      if (error) {
        throw error;
      }

      // Update local state
      setSession(prevSession => {
        if (prevSession) {
          return { ...prevSession, current_game: nextGameNumber };
        }
        return prevSession;
      });
      setCurrentGameNumber(nextGameNumber);

      // Reset game state
      setCalledNumbers([]);
      setLastCalledNumber(null);
      setSelectedPatterns([]);

      // Update session progress
      await updateSessionProgress(session.id, {
        game_status: 'pending'
      });
    } catch (err) {
      console.error('Error starting next game:', err);
      toast({
        title: "Error",
        description: "Failed to start the next game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers]);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!session) {
    return <div>Session not found.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Caller Session: {session.name}</h1>

      {sessionStatus === 'pending' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Game Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <GameTypeSelector
                currentGameType={gameType}
                onGameTypeChange={handleGameTypeChange}
              />

              <WinPatternSelector
                patterns={availablePatterns}
                selectedPatterns={selectedPatterns}
                onPatternSelect={handlePatternSelect}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Session Name</Label>
                <Input type="text" value={session.name} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Access Code</Label>
                <Input type="text" value={session.accessCode} readOnly />
              </div>
              <Button onClick={handleGoLive}>Go Live</Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <LiveGameView
          gameType={gameType}
          winPatterns={availablePatterns}
          selectedPatterns={selectedPatterns}
          currentWinPattern={currentWinPattern}
          onCallNumber={handleGenerateNewNumber}
          onRecall={handleRecallNumber}
          lastCalledNumber={lastCalledNumber}
          calledNumbers={calledNumbers}
          pendingClaims={pendingClaims}
          onViewClaims={handleViewClaims}
          sessionStatus={sessionStatus}
          onCloseGame={handleGameEnd}
          currentGameNumber={currentGameNumber}
          numberOfGames={numberOfGames}
          gameConfigs={gameConfigs}
        />
      )}
    </div>
  );
}
