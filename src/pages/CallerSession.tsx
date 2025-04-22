import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import GameHeader from '@/components/game/GameHeader';
import GameTypeSelector from '@/components/game/GameTypeSelector';
import SessionMainContent from '@/components/game/SessionMainContent';
import ClaimVerificationSheet from '@/components/game/ClaimVerificationSheet';
import { useClaimManagement } from '@/hooks/useClaimManagement';
import { useWinPatternManagement } from '@/hooks/useWinPatternManagement';
import { useGameProgression } from '@/hooks/useGameProgression';

export default function CallerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions } = useSession();
  const [session, setSession] = useState(sessions.find(s => s.id === sessionId) || null);
  const [gameType, setGameType] = useState('90-ball');
  const [promptGameType, setPromptGameType] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [remainingNumbers, setRemainingNumbers] = useState<number[]>([]);
  const [sessionPlayers, setSessionPlayers] = useState<any[]>([]);
  const [autoMarking, setAutoMarking] = useState(false);
  const [isProcessingValidClaim, setIsProcessingValidClaim] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    showClaimSheet,
    currentClaim,
    setShowClaimSheet,
    setCurrentClaim,
    checkForClaims,
    claimQueue,
    processNextClaim,
    openClaimSheet,
    validateClaim,
    rejectClaim
  } = useClaimManagement(sessionId);

  const {
    winPatterns,
    winPrizes,
    winPatternConfigs,
    currentGameWinPattern,
    progressWinPattern,
    setWinPatterns,
    setWinPrizes,
    updatePrizeValue,
    togglePatternActive,
    validateWinClaim
  } = useWinPatternManagement(sessionId, gameType);

  const { progressToNextGame } = useGameProgression(session);

  useEffect(() => {
    console.log("CallerSession - state update", {
      showClaimSheet,
      claimQueueLength: claimQueue?.length,
      currentGameWinPattern
    });
  }, [showClaimSheet, claimQueue, currentGameWinPattern]);

  useEffect(() => {
    if (!session && sessionId) {
      const foundSession = sessions.find(s => s.id === sessionId);
      if (foundSession) {
        setSession(foundSession);
        console.log("Session found:", foundSession);
      } else {
        console.log("Session not found for ID:", sessionId);
      }
    }
  }, [sessionId, sessions, session]);

  useEffect(() => {
    setPromptGameType(!session?.gameType);
  }, [session]);

  useEffect(() => {
    if (gameType === "90-ball" && remainingNumbers.length === 0) {
      setRemainingNumbers(Array.from({ length: 90 }, (_, i) => i + 1));
    } else if (gameType === "75-ball" && remainingNumbers.length === 0) {
      setRemainingNumbers(Array.from({ length: 75 }, (_, i) => i + 1));
    }
  }, [gameType, remainingNumbers.length]);

  useEffect(() => {
    if (sessionId) {
      const fetchCalledNumbers = async () => {
        const { data, error } = await supabase
          .from('called_numbers')
          .select('number')
          .eq('session_id', sessionId)
          .order('called_at', { ascending: true });
          
        if (error) {
          console.error("Error fetching called numbers:", error);
          return;
        }
        
        if (data && data.length > 0) {
          const numbers = data.map(item => item.number);
          setCalledNumbers(numbers);
          setCurrentNumber(numbers[numbers.length - 1]);
          
          if (gameType === "90-ball" && remainingNumbers.length > 0) {
            setRemainingNumbers(prev => prev.filter(n => !numbers.includes(n)));
          }
        }
      };
      
      fetchCalledNumbers();
      
      const calledNumbersChannel = supabase
        .channel('called-numbers-listener')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'called_numbers',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            if (payload.new) {
              const newNumber = payload.new.number;
              console.log("New number called:", newNumber);
              setCalledNumbers(prev => [...prev, newNumber]);
              setCurrentNumber(newNumber);
              setRemainingNumbers(prev => prev.filter(n => n !== newNumber));
            }
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(calledNumbersChannel);
      };
    }
  }, [sessionId, gameType, remainingNumbers.length]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionId);

      if (error) {
        console.error("Error fetching players:", error);
        return;
      }

      if (data) {
        const formattedPlayers = data.map(p => ({
          id: p.id,
          nickname: p.nickname,
          joinedAt: p.joined_at,
          playerCode: p.player_code,
          tickets: p.tickets
        }));
        setSessionPlayers(formattedPlayers);
        console.log("Session players fetched:", formattedPlayers.length);
      }
    };

    fetchSessionPlayers();

    const playersChannel = supabase
      .channel('session-players')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log("Player change detected:", payload);
          fetchSessionPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      const fetchWinPatterns = async () => {
        const { data, error } = await supabase
          .from('win_patterns')
          .select('*')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (!error && data) {
          const patterns: string[] = [];
          if (data.one_line_active) patterns.push('oneLine');
          if (data.two_lines_active) patterns.push('twoLines');
          if (data.full_house_active) patterns.push('fullHouse');
          setWinPatterns(patterns);
        }
      };

      fetchWinPatterns();
    }
  }, [sessionId, setWinPatterns]);

  useEffect(() => {
    if (sessionId && session?.id) {
      console.log("Initial check for pending claims");
      const timer = setTimeout(() => {
        checkForClaims();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId, session?.id, checkForClaims]);

  const handleGameTypeChange = (type: string) => {
    setGameType(type);
    setPromptGameType(false);
    
    if (type === "90-ball") {
      setRemainingNumbers(Array.from({ length: 90 }, (_, i) => i + 1));
    } else if (type === "75-ball") {
      setRemainingNumbers(Array.from({ length: 75 }, (_, i) => i + 1));
    }
  };

  const handleTogglePattern = (patternId: string) => {
    togglePatternActive(patternId);
  };

  const handlePrizeChange = (patternId: string, value: string) => {
    updatePrizeValue(patternId, value);
  };

  const handleCallNumber = async (number: number) => {
    if (sessionId) {
      try {
        const { data, error } = await supabase
          .from('called_numbers')
          .insert([{ 
            session_id: sessionId, 
            number 
          }]);
          
        if (error) {
          console.error("Error saving called number:", error);
          toast({
            title: "Error",
            description: "Failed to save called number. Please try again.",
            variant: "destructive"
          });
          return;
        }
        
        setCurrentNumber(number);
        setCalledNumbers(prev => [...prev, number]);
        setRemainingNumbers(prev => prev.filter(n => n !== number));
      } catch (err) {
        console.error("Exception saving called number:", err);
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive"
        });
      }
    }
  };

  const handleValidClaim = async () => {
    console.log("handleValidClaim called");
    if (!currentClaim || !session || isProcessingValidClaim) return;

    try {
      setIsProcessingValidClaim(true);
      
      // First validate the claim - this sends notifications to players
      await validateClaim();
      
      // Then log the win in game_logs
      await supabase
        .from('game_logs')
        .insert({
          session_id: sessionId,
          player_id: currentClaim.playerId,
          game_number: session.numberOfGames,
          win_pattern: currentGameWinPattern,
          prize: winPrizes[currentGameWinPattern || ''],
          username: currentClaim.playerName,
          winning_ticket: currentClaim.tickets,
          numbers_called: calledNumbers,
          total_calls: calledNumbers.length
        });
        
      console.log("Game log created for valid claim");

      // Move to the next pattern or game
      const nextPattern = progressWinPattern();
      console.log("Progress win pattern result:", nextPattern);
      
      // If there are no more patterns, progress to the next game
      if (!nextPattern) {
        console.log("No more win patterns, progressing to next game");
        await progressToNextGame();
      }
      
      // Close the claim sheet
      setShowClaimSheet(true);
      setCurrentClaim(null);
      
    } catch (error) {
      console.error("Error processing valid claim:", error);
      toast({
        title: "Error",
        description: "Failed to process claim.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingValidClaim(false);
    }
  };

  const handleFalseClaim = async () => {
    console.log("handleFalseClaim called");
    if (!currentClaim) return;

    try {
      await rejectClaim();
    } catch (error) {
      console.error("Error processing false claim:", error);
      toast({
        title: "Error",
        description: "Failed to process false claim.",
        variant: "destructive"
      });
    }
  };

  const handleEndGame = () => {
    // Placeholder for end game logic
  };

  const handleGoLive = async () => {
    if (!session || !sessionId) return;
    
    try {
      await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId);

      toast({
        title: "Success",
        description: "Session is now live!",
      });
    } catch (error) {
      console.error('Error going live:', error);
      toast({
        title: "Error",
        description: "Failed to start the session",
        variant: "destructive"
      });
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session ID Missing</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (promptGameType) {
    return <GameTypeSelector onGameTypeSelect={handleGameTypeChange} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GameHeader 
        sessionName={session?.name || ''} 
        accessCode={session?.accessCode || ''} 
        autoMarking={autoMarking} 
        setAutoMarking={setAutoMarking} 
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SessionMainContent
          session={session}
          winPatterns={winPatterns}
          winPrizes={winPrizes}
          winPatternConfigs={winPatternConfigs}
          currentPattern={currentGameWinPattern}
          onTogglePattern={handleTogglePattern}
          onPrizeChange={handlePrizeChange}
          calledNumbers={calledNumbers}
          currentNumber={currentNumber}
          sessionPlayers={sessionPlayers}
          handleCallNumber={handleCallNumber}
          handleEndGame={handleEndGame}
          handleGoLive={handleGoLive}
          remainingNumbers={remainingNumbers}
          sessionId={sessionId || ''}
          claimQueue={claimQueue}
          openClaimSheet={openClaimSheet}
          gameType={gameType}
        />
      </main>
      
      <ClaimVerificationSheet
        isOpen={showClaimSheet}
        onClose={() => {
          console.log("Sheet close callback called");
          setShowClaimSheet(false);
        }}
        playerName={currentClaim?.playerName || ''}
        tickets={currentClaim?.tickets || []}
        calledNumbers={calledNumbers}
        currentNumber={currentNumber}
        onValidClaim={handleValidClaim}
        onFalseClaim={handleFalseClaim}
        currentWinPattern={currentGameWinPattern}
        gameType={gameType}
      />
    </div>
  );
}
