
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  winPatterns: string[];
  onCheckClaims?: () => void;
  claimCount?: number;
  openClaimSheet: () => void;
  gameType?: string;
  sessionStatus?: string;
  gameConfigs?: any[];
}

export default function CallerControls({ 
  onCallNumber, 
  onEndGame,
  onGoLive,
  remainingNumbers,
  sessionId,
  winPatterns,
  claimCount = 0,
  openClaimSheet,
  gameType,
  sessionStatus = 'pending',
  gameConfigs = []
}: CallerControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const { toast } = useToast();

  const handleCallNumber = () => {
    if (remainingNumbers.length === 0) {
      toast({
        title: "No more numbers",
        description: "All numbers have been called.",
        variant: "destructive"
      });
      return;
    }

    setIsCallingNumber(true);
    
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
      const number = remainingNumbers[randomIndex];
      
      onCallNumber(number);
      setIsCallingNumber(false);
    }, 1000);
  };

  const handleGoLiveClick = async () => {
    if (winPatterns.length === 0) {
      toast({
        title: "Error",
        description: "At least one win pattern must be selected before going live",
        variant: "destructive"
      });
      return;
    }

    setIsGoingLive(true);
    try {
      // Initialize sessions_progress with Game 1's active pattern and prize info
      await initializeSessionProgress();
      await onGoLive();
    } catch (error) {
      console.error('Error going live:', error);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGoingLive(false);
    }
  };

  const initializeSessionProgress = async () => {
    if (!sessionId || !gameConfigs || gameConfigs.length === 0) {
      console.error("Missing session ID or game configs for initialization");
      return;
    }
    
    try {
      // Get Game 1 configuration
      const game1Config = gameConfigs.find(config => config.gameNumber === 1) || gameConfigs[0];
      
      if (!game1Config || !game1Config.patterns) {
        console.error("Game 1 configuration or patterns not found");
        return;
      }
      
      console.log("Initializing session progress with Game 1 config:", game1Config);
      
      // Find the active pattern in Game 1
      const activePatterns = Object.entries(game1Config.patterns)
        .filter(([_, patternConfig]: [string, any]) => patternConfig.active === true);
      
      if (activePatterns.length === 0) {
        console.error("No active patterns found for Game 1");
        return;
      }
      
      const [patternId, patternConfig] = activePatterns[0];
      
      console.log("Using active pattern:", patternId, patternConfig);
      
      // Update the sessions_progress with Game 1's active pattern and prize info
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: patternId,
          current_prize: patternConfig.prizeAmount || '0.00',
          current_prize_description: patternConfig.description || '',
          current_game_type: game1Config.gameType || gameType || 'mainstage',
          game_status: 'active'
        })
        .eq('session_id', sessionId);
      
      if (error) {
        console.error("Error updating sessions_progress:", error);
        throw new Error("Failed to initialize session data");
      }
      
      console.log("Successfully initialized session progress with Game 1 data");
    } catch (error) {
      console.error("Error in initializeSessionProgress:", error);
      toast({
        title: "Initialization Error",
        description: "Failed to initialize game settings. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleBellClick = () => {
    openClaimSheet();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <div className="flex items-center">
            <span>Caller Controls</span>
            <Badge className="ml-2" variant={sessionStatus === 'active' ? 'default' : 'outline'}>
              {sessionStatus === 'active' ? 'Live' : 'Pending'}
            </Badge>
          </div>
          {claimCount > 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              className="relative"
              onClick={handleBellClick}
            >
              <Bell className="h-4 w-4 text-amber-500" />
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                {claimCount}
              </Badge>
            </Button>
          )}
          {claimCount === 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              className="relative"
              onClick={handleBellClick}
            >
              <Bell className="h-4 w-4 text-gray-500" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-100 p-3 rounded-md text-center">
          <div className="text-sm text-gray-500 mb-1">Remaining Numbers</div>
          <div className="text-2xl font-bold">{remainingNumbers.length}</div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <Button
            className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            disabled={isCallingNumber || remainingNumbers.length === 0 || sessionStatus !== 'active'}
            onClick={handleCallNumber}
          >
            {isCallingNumber ? 'Calling...' : 'Call Next Number'}
          </Button>
          
          <Button 
            variant="destructive"
            onClick={onEndGame}
          >
            End Game
          </Button>
          
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isGoingLive || winPatterns.length === 0 || sessionStatus === 'active'}
            onClick={handleGoLiveClick}
          >
            {isGoingLive ? 'Going Live...' : 'Go Live'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
