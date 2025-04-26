
import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GameSession, GameType, CurrentGameState, PrizeDetails, GameConfig } from '@/types';
import { WinPattern, WIN_PATTERNS } from '@/types/winPattern';
import { useToast } from "@/hooks/use-toast";
import { GameSetupView } from '@/components/caller/GameSetupView';
import { LiveGameView } from '@/components/caller/LiveGameView';
import ClaimVerificationSheet from '@/components/game/ClaimVerificationSheet';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  const [currentClaim, setCurrentClaim] = useState<any>(null);
  const { toast } = useToast();
  const { setSessionLifecycle } = useSessionLifecycle(sessionId);

  useEffect(() => {
    console.log("StateUpdate - currentGameType:", currentGameType);
    console.log("StateUpdate - selectedPatterns:", selectedPatterns);
    console.log("StateUpdate - prizes:", prizes);
    console.log("StateUpdate - gameConfigs:", gameConfigs);
  }, [currentGameType, selectedPatterns, prizes, gameConfigs]);
  
  const fetchWinPatterns = useCallback((gameType: GameType) => {
    console.log("Fetching win patterns for:", gameType);
    setWinPatterns(WIN_PATTERNS[gameType] || []);
  }, []);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      console.log("Fetching session data...");
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error("Error fetching session:", error);
        return;
      }
      
      console.log("Session data received:", data);
      
      let configs: GameConfig[] = [];
      if (data.games_config && Array.isArray(data.games_config)) {
        const jsonConfigs = data.games_config as Json[];
        configs = jsonConfigs.map((config: any): GameConfig => ({
          gameNumber: config.gameNumber || 1,
          gameType: (config.gameType as GameType) || 'mainstage',
          selectedPatterns: Array.isArray(config.selectedPatterns) ? config.selectedPatterns : ['oneLine'],
          prizes: config.prizes || {}
        }));
        console.log("Game configs loaded from database:", configs);
      } 
      
      const numberOfGames = data.number_of_games || 1;
      if (configs.length !== numberOfGames) {
        console.log(`Creating ${numberOfGames} default game configs`);
        
        configs = Array.from({ length: numberOfGames }, (_, index) => ({
          gameNumber: index + 1,
          gameType: (data.game_type as GameType) || 'mainstage',
          selectedPatterns: ['oneLine'],
          prizes: {
            'oneLine': {
              amount: '10.00',
              isNonCash: false,
              description: 'One Line Prize'
            }
          }
        }));
      }
      
      setGameConfigs(configs);
      
      if (configs.length > 0) {
        const firstConfig = configs[0];
        console.log("Setting state from first game config:", firstConfig);
        setCurrentGameType(firstConfig.gameType);
        setSelectedPatterns(firstConfig.selectedPatterns || []);
        setPrizes(firstConfig.prizes || {});
        fetchWinPatterns(firstConfig.gameType);
      }

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

      if (gameState.calledItems && Array.isArray(gameState.calledItems)) {
        setCalledNumbers(gameState.calledItems as number[]);
      }
      
      if (gameState.lastCalledItem) {
        setCurrentNumber(gameState.lastCalledItem as number);
      }
      
    } catch (err) {
      console.error("Exception during session fetch:", err);
    }
  }, [sessionId, fetchWinPatterns]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleGameTypeChange = async (newType: GameType) => {
    if (!session) return;
    
    console.log("Changing game type to:", newType);
    
    setCurrentGameType(newType);
    fetchWinPatterns(newType);
    setCalledNumbers([]);
    setCurrentNumber(null);
    
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
      activePatternIds: selectedPatterns
    };

    try {
      // Convert the CurrentGameState to a plain JSON-compatible object
      const gameStateForSupabase = {
        gameNumber: updatedGameState.gameNumber,
        gameType: updatedGameState.gameType,
        activePatternIds: updatedGameState.activePatternIds,
        calledItems: updatedGameState.calledItems || [],
        lastCalledItem: updatedGameState.lastCalledItem,
        status: updatedGameState.status,
        prizes: JSON.parse(JSON.stringify(updatedGameState.prizes || {}))
      };

      const { error } = await supabase
        .from('game_sessions')
        .update({
          game_type: newType,
          current_game_state: gameStateForSupabase as Json,
          games_config: updatedConfigs as Json
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
        toast({
          title: "Game type updated",
          description: `Changed to ${newType} Bingo`,
        });
      }
    } catch (err) {
      console.error("Exception during game type update:", err);
    }
  };

  const handlePatternSelect = async (pattern: WinPattern) => {
    if (!session?.current_game_state) return;
    
    const patternId = String(pattern.id);
    console.log("Toggle pattern:", patternId);
    
    const newSelectedPatterns = [...selectedPatterns];
    const patternIndex = newSelectedPatterns.indexOf(patternId);
    
    if (patternIndex >= 0) {
      newSelectedPatterns.splice(patternIndex, 1);
      const updatedPrizes = {...prizes};
      delete updatedPrizes[patternId];
      setPrizes(updatedPrizes);
    } else {
      newSelectedPatterns.push(patternId);
      
      if (!prizes[patternId]) {
        const updatedPrizes = {
          ...prizes,
          [patternId]: {
            amount: '10.00',
            isNonCash: false,
            description: `${pattern.name} Prize`
          }
        };
        setPrizes(updatedPrizes);
      }
    }
    
    console.log("New selected patterns:", newSelectedPatterns);
    setSelectedPatterns(newSelectedPatterns);
    
    const updatedConfigs = [...gameConfigs];
    if (updatedConfigs[currentGameIndex]) {
      updatedConfigs[currentGameIndex].selectedPatterns = newSelectedPatterns;
      updatedConfigs[currentGameIndex].prizes = {...prizes};
      
      if (patternIndex >= 0 && updatedConfigs[currentGameIndex].prizes[patternId]) {
        delete updatedConfigs[currentGameIndex].prizes[patternId];
      }
    }
    setGameConfigs(updatedConfigs);
    
    const updatedGameState = {
      ...session.current_game_state,
      activePatternIds: newSelectedPatterns,
      prizes: prizes
    };
    
    setSession(prevSession => prevSession ? {
      ...prevSession,
      current_game_state: updatedGameState,
      games_config: updatedConfigs
    } : null);
    
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          current_game_state: updatedGameState as unknown as Json,
          games_config: updatedConfigs as unknown as Json
        })
        .eq('id', sessionId);

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
    } catch (err) {
      console.error("Exception during pattern select:", err);
    }
  };

  const handlePrizeChange = async (patternId: string, prizeDetails: PrizeDetails) => {
    console.log(`Updating prize for ${patternId}:`, prizeDetails);
    
    const updatedPrizes = {
      ...prizes,
      [patternId]: prizeDetails
    };
    setPrizes(updatedPrizes);
    
    const updatedConfigs = [...gameConfigs];
    if (updatedConfigs[currentGameIndex]) {
      updatedConfigs[currentGameIndex].prizes = {
        ...updatedConfigs[currentGameIndex].prizes,
        [patternId]: prizeDetails
      };
      setGameConfigs(updatedConfigs);
    }
    
    if (session) {
      const updatedGameState = {
        ...session.current_game_state,
        prizes: updatedPrizes
      };
      
      setSession(prevSession => prevSession ? {
        ...prevSession,
        current_game_state: updatedGameState,
        games_config: updatedConfigs
      } : null);
      
      try {
        const { error } = await supabase
          .from('game_sessions')
          .update({
            current_game_state: updatedGameState as unknown as Json,
            games_config: updatedConfigs as unknown as Json
          })
          .eq('id', sessionId);
          
        if (error) {
          console.error("Error updating prize details:", error);
        }
      } catch (err) {
        console.error("Exception during prize update:", err);
      }
    }
  };

  const handleGoLive = async () => {
    if (!session) return;
    
    setIsGoingLive(true);
    
    const currentConfig = gameConfigs[currentGameIndex];
    const patternsToCheck = currentConfig?.selectedPatterns || session.current_game_state?.activePatternIds;
    
    if (!patternsToCheck || patternsToCheck.length === 0) {
      toast({
        title: "Cannot start game",
        description: "Please select at least one win pattern before starting the game.",
        variant: "destructive"
      });
      setIsGoingLive(false);
      return;
    }

    try {
      console.log("Attempting to set session to live state...");
      
      const updatedGameState: CurrentGameState = {
        ...session.current_game_state,
        status: 'active',
        activePatternIds: patternsToCheck,
        prizes: prizes
      };
      
      // Create a plain JSON-compatible object for Supabase
      const gameStateForSupabase = {
        gameNumber: updatedGameState.gameNumber,
        gameType: updatedGameState.gameType,
        activePatternIds: updatedGameState.activePatternIds,
        calledItems: updatedGameState.calledItems || [],
        lastCalledItem: updatedGameState.lastCalledItem,
        status: updatedGameState.status,
        prizes: JSON.parse(JSON.stringify(updatedGameState.prizes || {}))
      };
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ 
          lifecycle_state: 'live',
          status: 'active', // Update the session status to active
          current_game_state: gameStateForSupabase as Json
        })
        .eq('id', sessionId);

      if (error) {
        console.error("Error starting game:", error);
        toast({
          title: "Error",
          description: "Failed to start the game. Please try again.",
          variant: "destructive"
        });
        setIsGoingLive(false);
      } else {
        setSession(prevSession => {
          if (!prevSession) return null;
          return {
            ...prevSession,
            lifecycle_state: 'live',
            status: 'active', // Update the local session status as well
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
      setIsGoingLive(false);
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

      try {
        // Create a plain JSON-compatible object for Supabase
        const gameStateForSupabase = {
          gameNumber: updatedGameState.gameNumber,
          gameType: updatedGameState.gameType,
          activePatternIds: updatedGameState.activePatternIds,
          calledItems: updatedGameState.calledItems,
          lastCalledItem: updatedGameState.lastCalledItem,
          status: updatedGameState.status,
          prizes: JSON.parse(JSON.stringify(updatedGameState.prizes || {}))
        };

        const { error } = await supabase
          .from('game_sessions')
          .update({ current_game_state: gameStateForSupabase as Json })
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
      } catch (err) {
        console.error("Exception during number calling:", err);
      }
    }
  };

  const checkForClaims = async () => {
    if (!sessionId) return;

    try {
      const { data: claims, error } = await supabase
        .from('bingo_claims')
        .select('id, player_id, claimed_at, players(nickname)')
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
        setPendingClaims(claims || []);
        
        if (claims && claims.length > 0) {
          const firstClaim = claims[0];
          
          const { data: ticketData, error: ticketError } = await supabase
            .from('assigned_tickets')
            .select('*')
            .eq('player_id', firstClaim.player_id)
            .eq('session_id', sessionId);
            
          if (ticketError) {
            console.error("Error fetching ticket data:", ticketError);
          } else {
            setCurrentClaim({
              playerName: firstClaim.players?.nickname || 'Unknown',
              playerId: firstClaim.player_id,
              tickets: ticketData || [],
              claimId: firstClaim.id
            });
            
            setShowClaimSheet(true);
            
            toast({
              title: "Claim ready for verification",
              description: `${firstClaim.players?.nickname || 'A player'} has claimed bingo!`,
            });
          }
        } else {
          toast({
            title: "No claims",
            description: "There are no pending claims at this time.",
          });
        }
      }
    } catch (err) {
      console.error("Exception during claims check:", err);
    }
  };

  const handleValidClaim = async () => {
    if (!currentClaim || !sessionId) return;
    
    try {
      const { error } = await supabase
        .from('bingo_claims')
        .update({ status: 'validated' })
        .eq('id', currentClaim.claimId);
        
      if (error) {
        console.error("Error validating claim:", error);
        toast({
          title: "Error",
          description: "Failed to validate claim. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'valid'
          }
        });
      
      toast({
        title: "Claim Validated",
        description: `${currentClaim.playerName}'s claim has been validated.`
      });
      
      // Save the game log data
      if (session && session.current_game_state) {
        const winPatternId = session.current_game_state.activePatternIds[0] || 'unknown';
        const winPrize = session.current_game_state.prizes?.[winPatternId];
        
        try {
          const ticketData = currentClaim.tickets && currentClaim.tickets.length > 0 
            ? currentClaim.tickets[0] 
            : null;
            
          if (ticketData) {
            const logData = {
              session_id: sessionId,
              game_number: session.current_game_state.gameNumber,
              game_type: session.current_game_state.gameType,
              win_pattern: winPatternId,
              player_id: currentClaim.playerId,
              player_name: currentClaim.playerName,
              player_email: ticketData.player_email || null,
              ticket_serial: ticketData.serial,
              ticket_perm: ticketData.perm,
              ticket_position: ticketData.position,
              ticket_layout_mask: ticketData.layout_mask,
              ticket_numbers: ticketData.numbers,
              called_numbers: session.current_game_state.calledItems || [],
              total_calls: (session.current_game_state.calledItems || []).length,
              last_called_number: session.current_game_state.lastCalledItem,
              prize: winPrize?.description || null,
              prize_amount: winPrize?.amount || null,
              prize_shared: winPrize?.isNonCash || false
            };
            
            const { error: logError } = await supabase
              .from('universal_game_logs')
              .insert(logData);
              
            if (logError) {
              console.error("Error saving game log:", logError);
            } else {
              console.log("Game log saved successfully");
            }
          }
        } catch (logErr) {
          console.error("Exception saving game log:", logErr);
        }
      }
      
      // Handle advancing to next pattern or game
      if (session && selectedPatterns.length > 1) {
        const currentPatternIndex = selectedPatterns.findIndex(p => p === selectedPatterns[0]);
        
        if (currentPatternIndex !== -1 && currentPatternIndex < selectedPatterns.length - 1) {
          const updatedPatterns = [...selectedPatterns];
          const completedPattern = updatedPatterns.shift();
          
          if (completedPattern) {
            console.log(`Win pattern ${completedPattern} completed`);
          }
          
          console.log("Advancing to next win pattern:", updatedPatterns[0]);
          
          if (session.current_game_state) {
            const updatedGameState = {
              ...session.current_game_state,
              activePatternIds: updatedPatterns
            };
            
            // Create a plain JSON-compatible object for Supabase
            const gameStateForSupabase = {
              gameNumber: updatedGameState.gameNumber,
              gameType: updatedGameState.gameType,
              activePatternIds: updatedGameState.activePatternIds,
              calledItems: updatedGameState.calledItems,
              lastCalledItem: updatedGameState.lastCalledItem,
              status: updatedGameState.status,
              prizes: JSON.parse(JSON.stringify(updatedGameState.prizes || {}))
            };
            
            await supabase
              .from('game_sessions')
              .update({ current_game_state: gameStateForSupabase as Json })
              .eq('id', sessionId);
              
            setSelectedPatterns(updatedPatterns);
            setSession(prev => prev ? {
              ...prev,
              current_game_state: updatedGameState
            } : null);
            
            toast({
              title: "Next Win Pattern",
              description: `Advanced to the next win pattern.`
            });
          }
        } else if (session.current_game_state && 
                  session.numberOfGames && 
                  session.current_game_state.gameNumber < session.numberOfGames) {
          // This was the last pattern and there are more games - prepare for next game
          const nextGameNumber = session.current_game_state.gameNumber + 1;
          const nextGameIndex = nextGameNumber - 1;
          const nextGameConfig = gameConfigs[nextGameIndex];
          
          if (nextGameConfig) {
            // Reset for next game
            setCalledNumbers([]);
            setCurrentNumber(null);
            setCurrentGameType(nextGameConfig.gameType);
            setSelectedPatterns(nextGameConfig.selectedPatterns || []);
            setPrizes(nextGameConfig.prizes || {});
            
            const nextGameState: CurrentGameState = {
              gameNumber: nextGameNumber,
              gameType: nextGameConfig.gameType,
              activePatternIds: nextGameConfig.selectedPatterns || [],
              calledItems: [],
              lastCalledItem: null,
              status: 'active',
              prizes: nextGameConfig.prizes || {}
            };
            
            // Create a plain JSON-compatible object for Supabase
            const gameStateForSupabase = {
              gameNumber: nextGameState.gameNumber,
              gameType: nextGameState.gameType,
              activePatternIds: nextGameState.activePatternIds,
              calledItems: nextGameState.calledItems,
              lastCalledItem: nextGameState.lastCalledItem,
              status: nextGameState.status,
              prizes: JSON.parse(JSON.stringify(nextGameState.prizes || {}))
            };
            
            await supabase
              .from('game_sessions')
              .update({ 
                current_game_state: gameStateForSupabase as Json,
                current_game: nextGameNumber
              })
              .eq('id', sessionId);
              
            setSession(prev => prev ? {
              ...prev,
              current_game: nextGameNumber,
              current_game_state: nextGameState
            } : null);
            
            toast({
              title: "Next Game",
              description: `Advanced to Game ${nextGameNumber}`
            });
          }
        }
      }
      
      setTimeout(() => {
        setShowClaimSheet(false);
      }, 500);
      
      setTimeout(() => {
        checkForClaims();
      }, 2000);
    } catch (err) {
      console.error("Error during claim validation:", err);
    }
  };

  const handleFalseClaim = async () => {
    if (!currentClaim || !sessionId) return;
    
    try {
      const { error } = await supabase
        .from('bingo_claims')
        .update({ status: 'rejected' })
        .eq('id', currentClaim.claimId);
        
      if (error) {
        console.error("Error rejecting claim:", error);
        toast({
          title: "Error",
          description: "Failed to reject claim. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      await supabase
        .channel('game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-result',
          payload: { 
            playerId: currentClaim.playerId,
            result: 'rejected'
          }
        });
      
      toast({
        title: "Claim Rejected",
        description: `${currentClaim.playerName}'s claim has been rejected.`
      });
      
      setShowClaimSheet(false);
      setCurrentClaim(null);
      
      checkForClaims();
    } catch (err) {
      console.error("Error during claim rejection:", err);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    
    console.log("Setting up real-time listener for bingo claims on session", sessionId);
    
    const channel = supabase
      .channel('caller-claims')
      .on(
        'broadcast',
        { event: 'bingo-claim' },
        async (payload) => {
          console.log("Received bingo claim broadcast:", payload);
          
          if (payload.payload && payload.payload.playerId && payload.payload.playerName) {
            const claimData = payload.payload;
            
            toast({
              title: "New Bingo Claim!",
              description: `${claimData.playerName} has claimed bingo! Click 'View Claims' to verify.`,
              variant: "default",
            });
            
            setPendingClaims(prev => [...prev, { 
              id: claimData.claimId,
              player_id: claimData.playerId,
              players: { nickname: claimData.playerName }
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Removing channel for bingo claims");
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

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
          isGoingLive={isGoingLive}
          prizes={prizes}
          onPrizeChange={handlePrizeChange}
          gameConfigs={gameConfigs}
          numberOfGames={session.numberOfGames || 1}
          setGameConfigs={setGameConfigs}
        />
      ) : session.lifecycle_state === 'live' ? (
        <>
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
            gameConfigs={gameConfigs}
            sessionStatus={session.status}
          />
          
          {currentClaim && (
            <ClaimVerificationSheet
              isOpen={showClaimSheet}
              onClose={() => setShowClaimSheet(false)}
              playerName={currentClaim.playerName}
              tickets={currentClaim.tickets || []}
              calledNumbers={calledNumbers}
              currentNumber={currentNumber}
              onValidClaim={handleValidClaim}
              onFalseClaim={handleFalseClaim}
              currentWinPattern={selectedPatterns[0] || null}
              gameType={`MAINSTAGE_${currentGameType}`}
            />
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg text-gray-500">Session has ended or not found. Current state: {session?.lifecycle_state}</p>
        </div>
      )}
    </div>
  );
}
