import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { generateAccessCode } from "@/utils/accessCodeGenerator";
import { GameSetupView } from '@/components/caller/GameSetupView';
import { LiveGameView } from '@/components/caller/LiveGameView';
import { WinPattern } from '@/types/winPattern';
import { DEFAULT_PATTERN_ORDER } from '@/types';
import { supabase } from "@/integrations/supabase/client";
import { GameType, GameSession, GameConfig } from '@/types';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { updateSessionProgress } from '@/utils/callerSessionHelper';
import { prepareForDatabase } from '@/utils/jsonUtils';

interface Claim {
  id: string;
  session_id: string;
  player_id: string;
  player_name: string;
  win_pattern: string;
  prize_amount: string;
  ticket_serial: string;
  ticket_position: number;
  ticket_layout_mask: number;
  ticket_numbers: number[];
  claimed_at: string;
}

export default function CallerSession() {
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const sessionId = routeSessionId || localStorage.getItem('currentSessionId') || '';
  const [session, setSession] = useState<GameSession | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [numberOfGames, setNumberOfGames] = useState(1);
  const [currentGameNumber, setCurrentGameNumber] = useState(1);
  const [currentGameType, setCurrentGameType] = useState<GameType>('mainstage');
  const [winPatterns, setWinPatterns] = useState<WinPattern[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [calledItems, setCalledItems] = useState<number[]>([]);
  const [lastCalledItem, setLastCalledItem] = useState<number | null>(null);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isClaimsDialogOpen, setIsClaimsDialogOpen] = useState(false);
  const [gameStatus, setGameStatus] = useState<string>('pending');
  const [currentWinPattern, setCurrentWinPattern] = useState<string | null>(null);
  const [currentGameConfigs, setCurrentGameConfigs] = useState<GameConfig[]>([]);
  const [currentGameTypeFromProgress, setCurrentGameTypeFromProgress] = useState<GameType>('mainstage');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get session progress from the database for authoritative game state
  const { progress: sessionProgress } = useSessionProgress(sessionId);

  useEffect(() => {
    if (sessionProgress) {
      setCurrentWinPattern(sessionProgress.current_win_pattern || null);
      setCurrentGameType(sessionProgress.current_game_type as GameType);
      
      // Handle called_numbers if it exists, otherwise fallback to empty array
      const calledNumbers = sessionProgress.called_numbers || [];
      
      if (calledNumbers && calledNumbers.length > 0) {
        setCalledItems(calledNumbers);
        setLastCalledItem(calledNumbers[calledNumbers.length - 1] || null);
      }
      
      // Update game status 
      const gameStatus = sessionProgress.game_status || 'pending';
      setGameStatus(gameStatus as 'pending' | 'active' | 'completed');
    }
  }, [sessionProgress]);

  const fetchSessionById = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        // Create a properly typed GameSession object
        const session: GameSession = {
          id: data.id,
          name: data.name,
          gameType: data.game_type as GameType,
          createdBy: data.created_by,
          accessCode: data.access_code,
          status: data.status as 'pending' | 'active' | 'completed',
          createdAt: data.created_at,
          sessionDate: data.session_date,
          numberOfGames: data.number_of_games,
          current_game: data.current_game,
          lifecycle_state: data.lifecycle_state as 'setup' | 'live' | 'ended' | 'completed',
          games_config: Array.isArray(data.games_config) 
            ? (data.games_config as GameConfig[]) 
            : []
        };
        
        setSession(session);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    }
  }, []);

  const fetchClaims = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select(`
          id, 
          session_id,
          player_id,
          player_name,
          win_pattern,
          prize_amount,
          ticket_serial,
          ticket_position,
          ticket_layout_mask,
          ticket_numbers,
          claimed_at
        `)
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error fetching claims:', error);
        return;
      }

      setClaims(data || []);
      setPendingClaims(data ? data.length : 0);
    } catch (err) {
      console.error('Error fetching claims:', err);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId);
      fetchSessionById(sessionId);
      fetchClaims(sessionId);
    }
  }, [sessionId, fetchSessionById, fetchClaims]);

  useEffect(() => {
    if (session) {
      setSessionName(session.name);
      setAccessCode(session.accessCode);
      setNumberOfGames(session.numberOfGames);
      setCurrentGameNumber(session.current_game);
      setCurrentGameType(session.gameType);
      setCurrentGameConfigs(session.games_config);
      
      const gameRules = getGameRulesForType(session.gameType);
      setWinPatterns(gameRules.getWinPatterns());
      
      // Set initial selected patterns
      if (session.games_config && session.games_config.length > 0) {
        const firstGameConfig = session.games_config[0];
        if (firstGameConfig.patterns) {
          setSelectedPatterns(Object.keys(firstGameConfig.patterns).filter(key => firstGameConfig.patterns[key].active));
        } else if (firstGameConfig.selectedPatterns) {
          setSelectedPatterns(firstGameConfig.selectedPatterns);
        } else {
          setSelectedPatterns(DEFAULT_PATTERN_ORDER[session.gameType] || []);
        }
      } else {
        setSelectedPatterns(DEFAULT_PATTERN_ORDER[session.gameType] || []);
      }
    }
  }, [session]);

  const handleGameTypeChange = (type: GameType) => {
    setCurrentGameType(type);
    const gameRules = getGameRulesForType(type);
    setWinPatterns(gameRules.getWinPatterns());
    setSelectedPatterns(DEFAULT_PATTERN_ORDER[type] || []);
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

  const startSession = async () => {
    setIsStarting(true);
    try {
      const newAccessCode = generateAccessCode(6);
      setAccessCode(newAccessCode);

      const { error } = await supabase
        .from('game_sessions')
        .update({ access_code: newAccessCode })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session Started",
        description: "The session has been started with a new access code.",
      });
    } catch (err) {
      console.error("Error starting session:", err);
      toast({
        title: "Error",
        description: "Failed to start the session.",
        variant: "destructive"
      });
    } finally {
      setIsStarting(false);
    }
  };

  const saveSessionName = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ name: sessionName })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session Name Updated",
        description: "The session name has been updated successfully.",
      });
    } catch (err) {
      console.error("Error saving session name:", err);
      toast({
        title: "Error",
        description: "Failed to update the session name.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const goLive = async () => {
    setIsGoingLive(true);
    try {
      // Update the game_sessions table to set the status to 'active' and lifecycle_state to 'live'
      await supabase
        .from('game_sessions')
        .update({
          status: 'active',
          lifecycle_state: 'live'
        })
        .eq('id', sessionId);

      // Also update the sessions_progress table to set the game_status to 'active'
      await supabase
        .from('sessions_progress')
        .update({
          game_status: 'active'
        })
        .eq('session_id', sessionId);

      // Notify
      toast({
        title: "Game is Live!",
        description: "The game has started and is now live.",
      });

      // Update local state
      setGameStatus('active');
    } catch (err) {
      console.error("Error going live:", err);
      toast({
        title: "Error",
        description: "Failed to start the game.",
        variant: "destructive"
      });
    } finally {
      setIsGoingLive(false);
    }
  };

  const callNumber = async () => {
    if (!session) return;

    try {
      // Generate a new random number based on the game type
      const gameRules = getGameRulesForType(currentGameType);
      const newNumber = gameRules.generateNewNumber(calledItems);

      // Update the called items array
      const updatedCalledItems = [...calledItems, newNumber];
      setCalledItems(updatedCalledItems);
      setLastCalledItem(newNumber);

      // Update the session progress in the database
      await updateSessionProgress(sessionId, {
        called_numbers: updatedCalledItems,
        current_game_type: currentGameType
      });

      // Notify
      toast({
        title: "Number Called",
        description: `The number ${newNumber} has been called.`,
      });
    } catch (err) {
      console.error("Error calling number:", err);
      toast({
        title: "Error",
        description: "Failed to call a new number.",
        variant: "destructive"
      });
    }
  };

  const recallNumber = async () => {
    if (!session) return;

    try {
      if (calledItems.length === 0) {
        toast({
          title: "No Numbers Called",
          description: "No numbers have been called yet.",
          variant: "destructive"
        });
        return;
      }

      // Remove the last called number
      const updatedCalledItems = calledItems.slice(0, -1);
      const recalledNumber = calledItems[calledItems.length - 1];

      setCalledItems(updatedCalledItems);
      setLastCalledItem(updatedCalledItems.length > 0 ? updatedCalledItems[updatedCalledItems.length - 1] : null);

      // Update the session progress in the database
      await updateSessionProgress(sessionId, {
        called_numbers: updatedCalledItems,
        current_game_type: currentGameType
      });

      // Notify
      toast({
        title: "Number Recalled",
        description: `The number ${recalledNumber} has been recalled.`,
      });
    } catch (err) {
      console.error("Error recalling number:", err);
      toast({
        title: "Error",
        description: "Failed to recall the last number.",
        variant: "destructive"
      });
    }
  };

  const updateSessionInDatabase = async (sessionId: string) => {
    try {
      // Update the game_sessions table without current_game_state
      await supabase
        .from('game_sessions')
        .update({
          status: gameStatus,
          current_game: currentGameNumber,
        })
        .eq('id', sessionId);
      
      // Instead, update the sessions_progress table
      await supabase
        .from('sessions_progress')
        .update({
          current_game_number: currentGameNumber,
          current_win_pattern: currentWinPattern,
          current_game_type: currentGameType,
          // Add called_numbers if the column exists
          ...(typeof sessionProgress?.called_numbers !== 'undefined' && {
            called_numbers: calledItems
          }),
          // Add game_status if the column exists
          ...(typeof sessionProgress?.game_status !== 'undefined' && {
            game_status: gameStatus
          })
        })
        .eq('session_id', sessionId);
      
    } catch (err) {
      console.error('Error updating session in database:', err);
      toast({
        title: 'Error',
        description: 'Failed to update game state in database',
        variant: 'destructive'
      });
    }
  };

  const closeGame = async () => {
    try {
      // Update game_sessions table
      await supabase
        .from('game_sessions')
        .update({
          status: 'completed',
          lifecycle_state: 'completed'
        })
        .eq('id', currentSession.id);
      
      // Also update sessions_progress
      await supabase
        .from('sessions_progress')
        .update({
          ...(typeof sessionProgress?.game_status !== 'undefined' && {
            game_status: 'completed'
          })
        })
        .eq('session_id', currentSession.id);
      
      // Redirect or handle UI changes
      navigate('/dashboard');
    } catch (err) {
      console.error('Error closing game:', err);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Session: {sessionName}</CardTitle>
        </CardHeader>
        <CardContent>
          {session ? (
            <>
              {session.lifecycle_state === 'setup' && (
                <GameSetupView
                  currentGameType={currentGameType}
                  onGameTypeChange={handleGameTypeChange}
                  winPatterns={winPatterns}
                  selectedPatterns={selectedPatterns}
                  onPatternSelect={handlePatternSelect}
                  onGoLive={goLive}
                  isGoingLive={isGoingLive}
                  gameConfigs={currentGameConfigs}
                  numberOfGames={numberOfGames}
                  setGameConfigs={setCurrentGameConfigs}
                />
              )}
              {session.lifecycle_state === 'live' && (
                <LiveGameView
                  gameType={currentGameType}
                  winPatterns={winPatterns}
                  selectedPatterns={selectedPatterns}
                  currentWinPattern={currentWinPattern}
                  onCallNumber={callNumber}
                  onRecall={recallNumber}
                  lastCalledNumber={lastCalledItem}
                  calledNumbers={calledItems}
                  pendingClaims={pendingClaims}
                  onViewClaims={() => setIsClaimsDialogOpen(true)}
                  gameConfigs={currentGameConfigs}
                  sessionStatus={gameStatus}
                  onCloseGame={closeGame}
                  currentGameNumber={currentGameNumber}
                  numberOfGames={numberOfGames}
                />
              )}
              <Dialog open={isClaimsDialogOpen} onOpenChange={setIsClaimsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Pending Claims</DialogTitle>
                    <DialogDescription>
                      Review and manage player claims for this session.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {claims.map(claim => (
                      <div key={claim.id} className="border rounded-md p-4">
                        <p>Player: {claim.player_name}</p>
                        <p>Pattern: {claim.win_pattern}</p>
                        <p>Ticket: {claim.ticket_serial}</p>
                        <p>Claimed at: {claim.claimed_at}</p>
                        <Button>Validate Claim</Button>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Close
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <p>Loading session...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
