import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { connectionManager } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';

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
  onForceClose?: () => Promise<void>;
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
  gameConfigs = [],
  onForceClose
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
      
      logWithTimestamp(`Caller is calling number ${number}`);
      
      // First create a new array of remaining numbers after removing the called number
      const updatedRemainingNumbers = remainingNumbers.filter(n => n !== number);
      
      // Calculate the called numbers by determining what's not in the remaining numbers
      const allPossibleNumbers = Array.from({ length: gameType === '75-ball' ? 75 : 90 }, (_, i) => i + 1);
      const calledNumbers = allPossibleNumbers.filter(n => !updatedRemainingNumbers.includes(n));
      
      // Broadcast the number call to all players - ensure this happens FIRST and RELIABLY
      try {
        logWithTimestamp(`Broadcasting number ${number} via realtime channel`);
        
        // Make multiple attempts to ensure the broadcast succeeds
        const broadcastChannel = supabase.channel('number-broadcast');
        
        // Use a more unique channel name with the session ID included
        const uniqueChannel = supabase.channel(`number-broadcast-${sessionId}`);
        
        // Attempt broadcasts on multiple channels for redundancy
        const broadcasts = [
          broadcastChannel.send({
            type: 'broadcast', 
            event: 'number-called',
            payload: {
              sessionId: sessionId,
              lastCalledNumber: number,
              calledNumbers: calledNumbers,
              timestamp: new Date().getTime()
            }
          }),
          
          uniqueChannel.send({
            type: 'broadcast', 
            event: 'number-called',
            payload: {
              sessionId: sessionId,
              lastCalledNumber: number,
              calledNumbers: calledNumbers,
              timestamp: new Date().getTime()
            }
          }),
          
          // Also broadcast on the general game-updates channel
          supabase.channel('game-updates').send({
            type: 'broadcast', 
            event: 'number-called',
            payload: {
              sessionId: sessionId,
              lastCalledNumber: number,
              calledNumbers: calledNumbers,
              timestamp: new Date().getTime()
            }
          })
        ];
        
        Promise.all(broadcasts)
          .then(() => {
            logWithTimestamp("Number broadcast sent successfully on all channels");
            
            // Also update the database for persistence
            supabase
              .from('sessions_progress')
              .update({
                called_numbers: calledNumbers,
                current_game_number: 1 // Ensure we're on game 1
              })
              .eq('session_id', sessionId)
              .then(() => {
                logWithTimestamp("Database updated with called numbers");
              })
              .catch(error => {
                console.error("Error updating database:", error);
              });
          })
          .catch(error => {
            console.error("Error broadcasting number:", error);
            
            // Fallback to connection manager if broadcast fails
            connectionManager.callNumber(number, sessionId);
          });
      } catch (err) {
        console.error("Error sending broadcast:", err);
        
        // Fallback to connection manager
        connectionManager.callNumber(number, sessionId);
      }
      
      // Always call the regular onCallNumber function for backwards compatibility
      onCallNumber(number);
      
      setIsCallingNumber(false);
    }, 1000);
  };

  // Handle the go live button click
  const handleGoLiveClick = async () => {
    setIsGoingLive(true);
    try {
      // Initialize sessions_progress with Game 1's active pattern and prize info
      await initializeSessionProgress();
      
      // Then also use the regular method (updates database directly)
      await onGoLive();
      
      // Also broadcast that the game is now live
      try {
        const broadcastChannel = supabase.channel('game-events');
        broadcastChannel.send({
          type: 'broadcast',
          event: 'game-live',
          payload: {
            sessionId: sessionId,
            timestamp: new Date().getTime(),
            message: "Game is now live"
          }
        }).then(() => {
          logWithTimestamp("Game live broadcast sent successfully");
        }).catch(error => {
          console.error("Error broadcasting game live status:", error);
        });
      } catch (err) {
        console.error("Error sending game live broadcast:", err);
      }
      
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
      
      console.log("Initializing session progress with Game 1 config: " + JSON.stringify(game1Config));
      
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
      
      console.log("Using active pattern: " + patternId + ", " + JSON.stringify(config));
      
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
      
    } catch (error) {
      console.log("Error in initializeSessionProgress: " + error);
      toast({
        title: "Initialization Error",
        description: "Failed to initialize game settings. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleForceClose = async () => {
    if (onForceClose) {
      try {
        toast({
          title: "Force closing game...",
          description: "Resetting the current game and proceeding to the next",
          duration: 2000
        });
        
        await onForceClose();
      } catch (error) {
        console.error("Error handling force close:", error);
        toast({
          title: "Error",
          description: "Failed to force close the game",
          variant: "destructive"
        });
      }
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
          <div>
            <Button 
              size="sm" 
              variant="outline" 
              className="relative"
              onClick={handleBellClick}
            >
              <Bell className={`h-4 w-4 ${claimCount > 0 ? 'text-amber-500' : 'text-gray-500'}`} />
              {claimCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                  {claimCount}
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
          
          {onForceClose && (
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleForceClose}
            >
              FORCE Close Game
            </Button>
          )}
          
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isGoingLive}
            onClick={handleGoLiveClick}
          >
            {isGoingLive ? 'Going Live...' : 'Go Live'}
          </Button>
        </div>
        
        <div className="text-xs text-green-600 flex items-center justify-center mt-2">
          <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
          Real-time updates enabled
        </div>
      </CardContent>
    </Card>
  );
}
