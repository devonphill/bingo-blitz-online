
import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType, CurrentGameState, PrizeDetails, GameConfig } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameSetupView } from '@/components/caller/GameSetupView';
import { LiveGameView } from '@/components/caller/LiveGameView';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentGameType, setCurrentGameType] = useState<GameType>('mainstage');
  const [winPatterns, setWinPatterns] = useState<WinPattern[]>(WIN_PATTERNS.mainstage);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<{[patternId: string]: PrizeDetails}>({});
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const { toast } = useToast();
  const { setSessionLifecycle } = useSessionLifecycle(sessionId);

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

      let lifecycleState: 'setup' | 'live' | 'ended' = 'setup';
      
      if (data.lifecycle_state) {
        if (['setup', 'live', 'ended'].includes(data.lifecycle_state)) {
          lifecycleState = data.lifecycle_state as 'setup' | 'live' | 'ended';
        } else {
          console.warn(`Invalid lifecycle_state value received: ${data.lifecycle_state}, using default 'setup'`);
        }
      }
      
      // Load games_config if available
      const configs = data.games_config ? (data.games_config as unknown as GameConfig[]) : [];
      setGameConfigs(configs);
      
      if (configs.length > 0) {
        // Use the first game config by default
        const firstConfig = configs[0];
        setCurrentGameType(firstConfig.gameType || 'mainstage');
        setSelectedPatterns(firstConfig.selectedPatterns || []);
        setPrizes(firstConfig.prizes || {});
      }
      
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
        current_game_state: gameState,
        lifecycle_state: lifecycleState,
        games_config: configs
      });

      setCalledNumbers(gameState.calledItems as number[]);
      setCurrentNumber(gameState.lastCalledItem as number);
      
      console.log("Session fetched:", data);
      console.log("Lifecycle state:", lifecycleState);
      console.log("Game configs from database:", configs);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentGameType) {
      fetchWinPatterns();
    }
  }, [currentGameType, fetchWinPatterns]);

  const handleGameTypeChange = async (newType: GameType) => {
    if (!session) return;
    
    // Update the current game config
    const updatedConfigs = [...gameConfigs];
    if (updatedConfigs[currentGameIndex]) {
      updatedConfigs[currentGameIndex].gameType = newType;
    }
    setGameConfigs(updatedConfigs);
    
    const updatedGameState: CurrentGameState = {
      ...session.current_game_state,
      gameType: newType,
      calledItems: [],
      lastCalledItem: null,
      activePatternIds: []
    };

    // Save both to database
    const { error } = await supabase
      .from('game_sessions')
      .update({
        game_type: newType,
        current_game_state: updatedGameState as unknown as Json,
        games_config: updatedConfigs as unknown as Json
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
    
    // Convert pattern.id to string to ensure consistent handling
    const patternId = String(pattern.id);
    
    // Update the local selected patterns
    const newSelectedPatterns = [...selectedPatterns];
    const patternIndex = newSelectedPatterns.indexOf(patternId);
    
    if (patternIndex >= 0) {
      newSelectedPatterns.splice(patternIndex, 1);
    } else {
      newSelectedPatterns.push(patternId);
    }
    setSelectedPatterns(newSelectedPatterns);
    
    // Update the current game config
    const updatedConfigs = [...gameConfigs];
    if (updatedConfigs[currentGameIndex]) {
      updatedConfigs[currentGameIndex].selectedPatterns = newSelectedPatterns;
    }
    setGameConfigs(updatedConfigs);
    
    // Prepare updated game state
    const updatedGameState = {
      ...session.current_game_state,
      activePatternIds: newSelectedPatterns
    };
    
    // Update session state
    setSession(prevSession => prevSession ? {
      ...prevSession,
      current_game_state: updatedGameState,
      games_config: updatedConfigs
    } : null);
    
    // Save to database
    supabase
      .from('game_sessions')
      .update({ 
        current_game_state: updatedGameState as unknown as Json,
        games_config: updatedConfigs as unknown as Json
      })
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
    if (!session) return;
    
    // Check if there are any selected patterns from games_config
    const currentConfig = gameConfigs[currentGameIndex];
    const patternsToCheck = currentConfig?.selectedPatterns || session.current_game_state?.activePatternIds;
    
    if (!patternsToCheck || patternsToCheck.length === 0) {
      toast({
        title: "Cannot start game",
        description: "Please select at least one win pattern before starting the game.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Attempting to set session to live state...");
      
      const updatedGameState: CurrentGameState = {
        ...session.current_game_state,
        status: 'active',
        activePatternIds: patternsToCheck
      };
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          lifecycle_state: 'live',
          current_game_state: updatedGameState as unknown as Json
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
        setSession(prevSession => {
          if (!prevSession) return null;
          return {
            ...prevSession,
            lifecycle_state: 'live',
            current_game_state: updatedGameState
          };
        });
        
        toast({
          title: "Game Started",
          description: "The game is now live!",
        });
        
        console.log("Game successfully set to live state");
      }
    } catch (err) {
      console.error("Exception during go live operation:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
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
      {!session ? (
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg text-gray-500">Loading session...</p>
        </div>
      ) : session.lifecycle_state === 'setup' ? (
        <GameSetupView
          currentGameType={currentGameType}
          onGameTypeChange={handleGameTypeChange}
          winPatterns={winPatterns}
          selectedPatterns={selectedPatterns}
          onPatternSelect={handlePatternSelect}
          onGoLive={handleGoLive}
          isGoingLive={false}
          prizes={prizes}
        />
      ) : session.lifecycle_state === 'live' ? (
        <LiveGameView
          gameType={currentGameType}
          winPatterns={winPatterns}
          selectedPatterns={selectedPatterns}
          currentWinPattern={selectedPatterns[0] || null}
          onCallNumber={callNumber}
          onRecall={() => setCurrentNumber(calledNumbers[calledNumbers.length - 1])}
          lastCalledNumber={currentNumber}
          calledNumbers={calledNumbers}
          pendingClaims={pendingClaims.length}
          onViewClaims={checkForClaims}
          prizes={prizes}
        />
      ) : (
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg text-gray-500">Session has ended or not found. Current state: {session.lifecycle_state}</p>
        </div>
      )}
    </div>
  );
}
