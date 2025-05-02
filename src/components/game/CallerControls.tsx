import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCallerHub } from '@/hooks/useCallerHub';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

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

  // Connect to the WebSocket hub as a caller
  const callerHub = useCallerHub(sessionId);

  // Display the number of connected players
  const connectedPlayersCount = callerHub.connectedPlayers.length;
  
  // Use pending claims from the WebSocket hub
  const pendingClaimsCount = callerHub.pendingClaims.length;

  // Update claims when we receive new ones
  useEffect(() => {
    if (pendingClaimsCount > 0 && pendingClaimsCount !== claimCount) {
      openClaimSheet();
    }
  }, [pendingClaimsCount, claimCount, openClaimSheet]);

  // Debug logging
  useEffect(() => {
    logWithTimestamp(`CallerControls: connection state: ${callerHub.connectionState}, isConnected: ${callerHub.isConnected}`);
  }, [callerHub.connectionState, callerHub.isConnected]);

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
      
      // Call the regular onCallNumber function for backwards compatibility
      onCallNumber(number);
      
      // Also broadcast via WebSocket for connected players
      if (callerHub.isConnected) {
        // Create a new array of called numbers by adding the newly called number
        // FIXED: Create newCalledNumbers array since calledNumbers doesn't exist in this scope
        const newCalledNumbers = [...remainingNumbers.filter(n => n !== number)];
        callerHub.callNumber(number, newCalledNumbers);
      }
      
      setIsCallingNumber(false);
    }, 1000);
  };

  // Handle the go live button click
  const handleGoLiveClick = async () => {
    setIsGoingLive(true);
    try {
      // Initialize sessions_progress with Game 1's active pattern and prize info
      await initializeSessionProgress();
      
      // Go live via WebSocket first
      if (callerHub.isConnected) {
        logWithTimestamp("Broadcasting game start via WebSocket");
        callerHub.startGame();
      }
      
      // Then also use the regular method (updates database directly)
      await onGoLive();
      
      toast({
        title: "Game is now live",
        description: "Players can now join and play.",
        duration: 3000
      });
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
      
      logWithTimestamp("Initializing session progress with Game 1 config: " + JSON.stringify(game1Config));
      
      // Find the active pattern in Game 1
      const activePatterns = Object.entries(game1Config.patterns)
        .filter(([_, patternConfig]) => {
          if (typeof patternConfig === 'object' && patternConfig !== null) {
            return (patternConfig as any).active === true;
          }
          return false;
        });
      
      if (activePatterns.length === 0) {
        console.error("No active patterns found for Game 1");
        return;
      }
      
      const [patternId, patternConfig] = activePatterns[0];
      const config = patternConfig as any;
      
      logWithTimestamp("Using active pattern: " + patternId + ", " + JSON.stringify(config));
      
      // Update the database directly
      await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: patternId,
          current_prize: config.prizeAmount || '0.00',
          current_prize_description: config.description || '',
          game_status: 'active'  // Set initial game status to active
        })
        .eq('session_id', sessionId);
      
      // Also notify players via WebSocket broadcast
      if (callerHub.isConnected) {
        logWithTimestamp("Broadcasting pattern and prize info via WebSocket");
        callerHub.changePattern(patternId);
      }
      
    } catch (error) {
      logWithTimestamp("Error in initializeSessionProgress: " + error);
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

  const isGoLiveDisabled = !callerHub.isConnected;

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
          <div className="flex items-center space-x-2">
            {connectedPlayersCount > 0 && (
              <Badge variant="secondary" className="mr-2">
                {connectedPlayersCount} player{connectedPlayersCount !== 1 ? 's' : ''} connected
              </Badge>
            )}
            
            <Button 
              size="sm" 
              variant="outline" 
              className="relative"
              onClick={handleBellClick}
            >
              <Bell className={`h-4 w-4 ${pendingClaimsCount > 0 ? 'text-amber-500' : 'text-gray-500'}`} />
              {pendingClaimsCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                  {pendingClaimsCount}
                </Badge>
              )}
            </Button>
          </div>
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
            disabled={isCallingNumber || remainingNumbers.length === 0 || sessionStatus !== 'active' || !callerHub.isConnected}
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
            disabled={isGoLiveDisabled}
            onClick={handleGoLiveClick}
          >
            {isGoingLive ? 'Going Live...' : 
              !callerHub.isConnected ? 'Connect First' : 'Go Live'}
          </Button>
        </div>
        
        {!callerHub.isConnected && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center justify-center mt-2">
            <span className="h-2 w-2 bg-amber-500 rounded-full mr-2"></span>
            Not connected to game server
          </div>
        )}
        {callerHub.isConnected && (
          <div className="text-xs text-green-600 flex items-center justify-center mt-2">
            <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
            Connected to game server
          </div>
        )}
      </CardContent>
    </Card>
  );
}
