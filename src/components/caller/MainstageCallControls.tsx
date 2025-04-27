
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, FastForward, SkipForward } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { GameType } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useSessionProgress } from '@/hooks/useSessionProgress';
import { Label } from '@/components/ui/label';

interface MainstageCallControlsProps {
  onCallNumber: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims?: () => void;
  onCloseGame?: () => void; 
  sessionStatus?: string;
  currentGameNumber?: number;
  numberOfGames?: number;
  activeWinPatterns: string[] | number[];
  currentSession: { id: string | undefined };
}

export function MainstageCallControls({
  onCallNumber,
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims,
  onCloseGame,
  sessionStatus = 'pending',
  currentGameNumber = 1,
  numberOfGames = 1,
  activeWinPatterns,
  currentSession
}: MainstageCallControlsProps) {
  const [isCallNumberLoading, setIsCallNumberLoading] = useState(false);
  const [isGameEndLoading, setIsGameEndLoading] = useState(false);
  const [isPatternEndLoading, setIsPatternEndLoading] = useState(false);
  const [currentPattern, setCurrentPattern] = useState<string | null>(null);
  const isLastGame = currentGameNumber >= numberOfGames;
  const { progress } = useSessionProgress(currentSession?.id);

  // Fix the type here to ensure activeWinPatterns is always a string array
  const safeActiveWinPatterns: string[] = Array.isArray(activeWinPatterns) 
    ? activeWinPatterns.map(pattern => String(pattern)) 
    : [];
    
  const patternProgressStep = 
    safeActiveWinPatterns.length > 0 ? 
    safeActiveWinPatterns.indexOf(currentPattern || safeActiveWinPatterns[0]) + 1 : 1;
  
  const totalPatternSteps = safeActiveWinPatterns.length || 1;
  
  const gameProgressPercentage = ((currentGameNumber - 1) / Math.max(1, numberOfGames - 1)) * 100;
  const patternProgressPercentage = ((patternProgressStep - 1) / Math.max(1, totalPatternSteps - 1)) * 100;
  
  // Get the names of the patterns for the dropdown
  const getPatternName = (patternId: string) => {
    if (patternId === 'oneLine') return 'One Line';
    if (patternId === 'twoLines') return 'Two Lines';
    if (patternId === 'fullHouse') return 'Full House';
    if (patternId === 'fourCorners') return 'Four Corners';
    if (patternId === 'cross') return 'Cross';
    if (patternId === 'pattern') return 'Pattern';
    if (patternId === 'blackout') return 'Blackout';
    
    // Handle prefixed patterns (e.g. MAINSTAGE_oneLine)
    if (patternId.includes('_')) {
      const [_, name] = patternId.split('_');
      return getPatternName(name);
    }
    
    return patternId;
  };
  
  useEffect(() => {
    // Set the current pattern from activeWinPatterns when available
    if (safeActiveWinPatterns.length > 0 && !currentPattern) {
      setCurrentPattern(safeActiveWinPatterns[0]);
    }
  }, [safeActiveWinPatterns, currentPattern]);
  
  // Update currentPattern if the session progress has a different current_win_pattern
  useEffect(() => {
    if (progress?.current_win_pattern && progress.current_win_pattern !== currentPattern) {
      setCurrentPattern(progress.current_win_pattern);
    }
  }, [progress, currentPattern]);

  const handleCallNumber = async () => {
    setIsCallNumberLoading(true);
    try {
      await onCallNumber();
    } finally {
      setIsCallNumberLoading(false);
    }
  };
  
  const handleNextPattern = async () => {
    setIsPatternEndLoading(true);
    try {
      // Find the current pattern in the list
      if (!currentPattern || safeActiveWinPatterns.length <= 1) return;
      
      const currentIndex = safeActiveWinPatterns.indexOf(currentPattern);
      if (currentIndex === -1 || currentIndex >= safeActiveWinPatterns.length - 1) return;
      
      const nextPattern = safeActiveWinPatterns[currentIndex + 1];
      
      // Update session progress with the next pattern
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: nextPattern
        })
        .eq('session_id', currentSession.id);
        
      if (progressError) {
        console.error("Error updating session progress:", progressError);
        return;
      }
      
      // Update game session - use type assertion to fix TypeScript error
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          // Type assertion to handle the TypeScript error
          active_pattern_id: nextPattern as any
        })
        .eq('id', currentSession.id);
        
      if (sessionError) {
        console.error("Error updating game session:", sessionError);
        return;
      }
      
      setCurrentPattern(nextPattern);
      
      // Send a broadcast to let all players know the pattern changed
      await supabase
        .channel('player-game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-update',
          payload: { 
            sessionId: currentSession.id,
            patternChange: true,
            nextPattern
          }
        });
        
      await supabase
        .channel('game-progression-listener')
        .send({
          type: 'broadcast',
          event: 'game-progression',
          payload: { 
            sessionId: currentSession.id,
            nextPattern
          }
        });
        
    } finally {
      setIsPatternEndLoading(false);
    }
  };

  const handleNextGame = async () => {
    if (isLastGame) {
      if (onCloseGame) onCloseGame();
      return;
    }
    
    setIsGameEndLoading(true);
    try {
      const nextGameNumber = currentGameNumber + 1;
      
      // Update session progress
      const { error: progressError } = await supabase
        .from('sessions_progress')
        .update({
          current_game_number: nextGameNumber,
          // Reset pattern to first if available
          current_win_pattern: null
        })
        .eq('session_id', currentSession.id);
        
      if (progressError) {
        console.error("Error updating session progress:", progressError);
        return;
      }
      
      // Update game session - use type assertion for active_pattern_id
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          current_game: nextGameNumber,
          active_pattern_id: null as any // Type assertion to fix TypeScript error
        })
        .eq('id', currentSession.id);
        
      if (sessionError) {
        console.error("Error updating game session:", sessionError);
        return;
      }
      
      // Send a broadcast to let all players know the game changed
      await supabase
        .channel('player-game-updates')
        .send({
          type: 'broadcast',
          event: 'claim-update',
          payload: { 
            sessionId: currentSession.id,
            gameChange: true,
            previousGame: currentGameNumber,
            newGame: nextGameNumber
          }
        });
        
      await supabase
        .channel('game-progression-listener')
        .send({
          type: 'broadcast',
          event: 'game-progression',
          payload: { 
            sessionId: currentSession.id,
            previousGame: currentGameNumber,
            newGame: nextGameNumber
          }
        });
        
      // Force page reload to update all state
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
        
    } finally {
      setIsGameEndLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Call Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4 p-4 border rounded-md bg-gray-50">
            <div className="text-6xl font-bold">
              {lastCalledNumber !== null ? lastCalledNumber : "-"}
            </div>
            <div className="text-sm text-gray-500">Last Called Number</div>
            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs">
                <span>Numbers Called: {totalCalls}</span>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full py-6 text-lg"
            onClick={handleCallNumber}
            disabled={isCallNumberLoading || sessionStatus !== 'active'}
          >
            <Megaphone className="mr-2 h-5 w-5" />
            {isCallNumberLoading ? "Calling..." : "Call Number"}
          </Button>
          
          {pendingClaims > 0 && onViewClaims && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onViewClaims}
            >
              View Claims ({pendingClaims})
            </Button>
          )}
        </div>
        
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label>Current Game</Label>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-md py-1 px-3">
                Game {currentGameNumber} of {numberOfGames}
              </Badge>
            </div>
            <Progress className="mt-2" value={gameProgressPercentage} />
          </div>
          
          {safeActiveWinPatterns.length > 0 && (
            <div>
              <Label>Current Win Pattern</Label>
              <Select 
                value={currentPattern || safeActiveWinPatterns[0]} 
                disabled={safeActiveWinPatterns.length <= 1}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {currentPattern ? getPatternName(currentPattern) : 'Select Pattern'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {safeActiveWinPatterns.map((pattern) => (
                    <SelectItem key={pattern} value={pattern}>
                      {getPatternName(pattern)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Progress className="mt-2" value={patternProgressPercentage} />
            </div>
          )}
          
          <div className="pt-2 flex gap-2">
            <Button
              variant="outline"
              onClick={handleNextPattern}
              className="flex-1"
              disabled={isPatternEndLoading || safeActiveWinPatterns.length <= 1 || !currentPattern || currentPattern === safeActiveWinPatterns[safeActiveWinPatterns.length - 1]}
            >
              <FastForward className="mr-2 h-4 w-4" />
              Next Pattern
            </Button>
            
            <Button
              variant="outline"
              onClick={handleNextGame}
              className="flex-1"
              disabled={isGameEndLoading}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              {isLastGame ? "Close Game" : "Next Game"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
