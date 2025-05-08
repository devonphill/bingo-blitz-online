import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameType, GameConfig } from '@/types';
import { WinPattern } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GameSetupView } from '@/components/caller/GameSetupView';
import { LiveGameView } from '@/components/caller/LiveGameView';
import { SessionProgressUpdate } from '@/utils/callerSessionHelper';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { jsonToGameConfigs } from '@/utils/jsonUtils';
import { WinPatternConfig } from '@/types';

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
  const [isGoingLive, setIsGoingLive] = useState(false);

  const gameRules = getGameRulesForType(gameType);
  const { progress, loading: progressLoading, error: progressError } = useSessionProgress(urlSessionId);

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
          
          console.log(`Loaded session with ${data.number_of_games} games and ${parsedConfigs.length} game configs`);
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

  useEffect(() => {
    if (session && numberOfGames > 0 && (!gameConfigs || gameConfigs.length < numberOfGames)) {
      console.log("Initializing game configs for", numberOfGames, "games");
      
      const newConfigs = Array.from({ length: numberOfGames }, (_, index) => {
        if (gameConfigs && index < gameConfigs.length && gameConfigs[index]) {
          return gameConfigs[index];
        }
        
        const patterns: Record<string, WinPatternConfig> = {};
        const gameType = session.gameType || 'mainstage';
        
        if (gameRules) {
          gameRules.getWinPatterns().forEach(pattern => {
            patterns[pattern.id] = {
              active: ['oneLine'].includes(pattern.id),
              isNonCash: false,
              prizeAmount: '10.00',
              description: `${pattern.name} Prize`
            };
          });
        }
        
        return {
          gameNumber: index + 1,
          gameType: gameType,
          patterns: patterns
        };
      });
      
      setGameConfigs(newConfigs);
    }
  }, [session, numberOfGames, gameConfigs, gameRules]);

  useEffect(() => {
    if (progress) {
      setCalledNumbers(progress.called_numbers || []);
      setCurrentWinPattern(progress.current_win_pattern);
    }
  }, [progress]);

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

  const handleGoLive = async () => {
    if (!session) return;

    try {
      setIsGoingLive(true);
      
      console.log("Going live with session:", session.id, "and game configs:", gameConfigs);
      
      // Get the current game config (default to first game)
      const currentGameConfig = gameConfigs.find(config => config.gameNumber === 1) || gameConfigs[0];
      
      // Find the first active pattern in the current game config
      let firstActivePattern = null;
      if (currentGameConfig && currentGameConfig.patterns) {
        // Find first active pattern
        const activePatternEntry = Object.entries(currentGameConfig.patterns)
          .find(([patternId, pattern]) => pattern.active === true);
        
        if (activePatternEntry) {
          firstActivePattern = activePatternEntry[0]; // This is the pattern ID
          console.log("First active pattern found:", firstActivePattern);
        }
      }
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', session.id);

      if (error) {
        throw error;
      }

      setSessionStatus('active');

      // Update the session progress with the initial win pattern
      await updateSessionProgress(session.id, {
        game_status: 'active',
        current_win_pattern: firstActivePattern || 'oneLine', // Default to oneLine if no active pattern found
        current_game_number: 1
      });
      
      console.log(`Session is now live with initial win pattern: ${firstActivePattern || 'oneLine'}`);
    } catch (err) {
      console.error('Error going live:', err);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGoingLive(false);
    }
  };

  const handleGameEnd = async () => {
    if (!session) return;

    try {
      // Check if this is truly the final game and pattern before marking as completed
      const isFinalGame = session.current_game >= session.numberOfGames;
      const currentGameConfig = gameConfigs.find(config => config.gameNumber === session.current_game);
      
      let activePatterns = [];
      if (currentGameConfig && currentGameConfig.patterns) {
        activePatterns = Object.entries(currentGameConfig.patterns)
          .filter(([_, pattern]) => pattern.active === true)
          .map(([patternId]) => patternId);
      }
      
      // Get the index of the current win pattern
      const currentPatternIndex = activePatterns.indexOf(currentWinPattern || '');
      const isFinalPattern = currentPatternIndex === activePatterns.length - 1;
      
      // Only mark as completed if we're at the final game and final pattern
      if (isFinalGame && isFinalPattern) {
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
        
        console.log("Final game and pattern completed - session marked as completed");
      } else {
        // Otherwise, we're just advancing to the next pattern or game
        console.log("Game not yet complete - only moving to next pattern/game");
        
        toast({
          title: "Next Pattern",
          description: "Moving to next pattern or game",
          duration: 3000
        });
      }
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
      const nextGameNumber = session.current_game + 1;
      const { error } = await supabase
        .from('game_sessions')
        .update({ current_game: nextGameNumber })
        .eq('id', session.id);

      if (error) {
        throw error;
      }

      setSession(prevSession => {
        if (prevSession) {
          return { ...prevSession, current_game: nextGameNumber };
        }
        return prevSession;
      });
      setCurrentGameNumber(nextGameNumber);

      setCalledNumbers([]);
      setLastCalledNumber(null);
      setSelectedPatterns([]);

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

  const handleGenerateNewNumber = () => {
    if (!gameRules || calledNumbers.length >= 90) {
      console.log("Cannot generate number: missing game rules or all numbers called");
      toast({
        title: "Cannot call number",
        description: "All available numbers have been called or game rules are not available",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Generating new bingo number with current called numbers:", calledNumbers);
      const newNumber = gameRules.generateNewNumber(calledNumbers);
      console.log("Generated new number:", newNumber);
      
      const updatedCalledNumbers = [...calledNumbers, newNumber];
      setCalledNumbers(updatedCalledNumbers);
      setLastCalledNumber(newNumber);

      if (session) {
        console.log("Broadcasting new called number:", newNumber);
        const broadcastChannel = supabase.channel('number-broadcast');
        broadcastChannel.send({
          type: 'broadcast', 
          event: 'number-called',
          payload: {
            sessionId: session.id,
            lastCalledNumber: newNumber,
            calledNumbers: updatedCalledNumbers,
            activeWinPattern: currentWinPattern,
            timestamp: new Date().getTime()
          }
        }).then(() => {
          console.log("Number broadcast sent successfully");
          
          console.log("Updating session progress with new called number:", newNumber);
          updateSessionProgress(session.id, {
            called_numbers: updatedCalledNumbers
          }).then(() => {
            console.log("Session progress updated successfully");
          }).catch(error => {
            console.error("Error updating session progress:", error);
          });
        }).catch(error => {
          console.error("Error broadcasting number:", error);
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

  const handleForceClose = async () => {
    if (!session) return;

    try {
      console.log("Force closing game and resetting all numbers");
      toast({
        title: "Force Closing Game",
        description: "Resetting game and advancing to next game...",
      });

      // Reset called numbers in session progress
      await updateSessionProgress(session.id, {
        called_numbers: [],
        game_status: 'pending'
      });

      setCalledNumbers([]);
      setLastCalledNumber(null);

      // If it's the last game, complete the session
      if (session.current_game >= session.numberOfGames) {
        const { error } = await supabase
          .from('game_sessions')
          .update({ status: 'completed' })
          .eq('id', session.id);

        if (error) throw error;
        setSessionStatus('completed');
      } 
      // Otherwise move to the next game
      else {
        const nextGameNumber = session.current_game + 1;
        const { error } = await supabase
          .from('game_sessions')
          .update({ current_game: nextGameNumber })
          .eq('id', session.id);

        if (error) throw error;

        setSession(prevSession => {
          if (prevSession) {
            return { ...prevSession, current_game: nextGameNumber };
          }
          return prevSession;
        });
        setCurrentGameNumber(nextGameNumber);
      }

      // Broadcast the reset to all connected clients
      const broadcastChannel = supabase.channel('game-reset-broadcast');
      broadcastChannel.send({
        type: 'broadcast', 
        event: 'game-reset',
        payload: {
          sessionId: session.id,
          lastCalledNumber: null,
          calledNumbers: [],
          timestamp: new Date().getTime()
        }
      }).catch(error => {
        console.error("Error broadcasting game reset:", error);
      });

    } catch (err) {
      console.error('Error force closing game:', err);
      toast({
        title: "Error",
        description: "Failed to force close the game. Please try again.",
        variant: "destructive"
      });
    }
  };

  const remainingNumbers = React.useMemo(() => {
    const allNumbers = Array.from({ length: gameType === 'mainstage' ? 90 : 75 }, (_, i) => i + 1);
    return allNumbers.filter(num => !calledNumbers.includes(num));
  }, [calledNumbers, gameType]);

  if (isLoading) {
    return <div className="container mx-auto p-6 flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Loading session...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto"></div>
      </div>
    </div>;
  }

  if (error) {
    return <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
      <p>{error}</p>
      <Button 
        variant="default" 
        className="mt-4" 
        onClick={() => navigate('/dashboard')}
      >
        Return to Dashboard
      </Button>
    </div>;
  }

  if (!session) {
    return <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Session not found</h1>
      <Button 
        variant="default" 
        className="mt-4" 
        onClick={() => navigate('/dashboard')}
      >
        Return to Dashboard
      </Button>
    </div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Caller Session: {session?.name}</h1>

      {sessionStatus === 'pending' ? (
        <GameSetupView
          currentGameType={gameType}
          onGameTypeChange={handleGameTypeChange}
          winPatterns={availablePatterns}
          selectedPatterns={selectedPatterns}
          onPatternSelect={handlePatternSelect}
          onGoLive={handleGoLive}
          isGoingLive={isGoingLive}
          gameConfigs={gameConfigs}
          numberOfGames={numberOfGames}
          setGameConfigs={setGameConfigs}
          sessionId={urlSessionId}
        />
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
          sessionId={session?.id}
        />
      )}
    </div>
  );
}
