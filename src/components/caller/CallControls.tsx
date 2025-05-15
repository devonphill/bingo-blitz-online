import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bell, RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCallerHub } from '@/hooks/useCallerHub';
import { logWithTimestamp } from '@/utils/logUtils';
import { GoLiveButton } from '@/components/ui/go-live-button';
import { getSingleSourceConnection } from '@/utils/connectionManager';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  winPatterns: string[];
  claimCount?: number;
  openClaimSheet: () => void;
  gameType?: string;
  sessionStatus?: string;
  onCloseGame?: () => void;
  numberOfGames?: number;
  currentGameNumber?: number;
  onForceClose?: () => void;
}

export default function CallControls({ 
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
  onCloseGame,
  numberOfGames = 1,
  currentGameNumber = 1,
  onForceClose
}: CallerControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isClosingConfirmOpen, setIsClosingConfirmOpen] = useState(false);
  const [isForceCloseConfirmOpen, setIsForceCloseConfirmOpen] = useState(false);
  const { toast } = useToast();
  
  // Connect to the WebSocket hub as a caller
  const callerHub = useCallerHub(sessionId);

  useEffect(() => {
    logWithTimestamp(`CallControls connection state: ${callerHub.connectionState}, isConnected: ${callerHub.isConnected}`);
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

    // Don't call numbers if there are pending claims
    if (claimCount > 0) {
      toast({
        title: "Pending claims",
        description: "Please verify all pending claims before calling more numbers.",
        variant: "destructive"
      });
      return;
    }

    setIsCallingNumber(true);
    
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
      const number = remainingNumbers[randomIndex];
      
      // IMPORTANT: First broadcast the number to all clients immediately
      try {
        logWithTimestamp(`Broadcasting number ${number} via realtime channels`);
        
        // Use a dedicated broadcast channel
        supabase.channel('number-broadcast').send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId: sessionId,
            lastCalledNumber: number,
            // We need to calculate the called numbers since we don't have direct access to the full list
            // We infer it from the remaining numbers
            calledNumbers: getCalledNumbersFromRemaining(number, remainingNumbers),
            timestamp: new Date().toISOString()
          }
        }).then(() => {
          logWithTimestamp("Number broadcast sent successfully");
        }).catch(error => {
          console.error("Error broadcasting number:", error);
        });
      } catch (err) {
        console.error("Error sending broadcast:", err);
      }
      
      // Also use the connection manager for database persistence
      const connection = getSingleSourceConnection();
      if (connection) {
        connection.callNumber(number, sessionId)
          .then(success => {
            if (!success) {
              console.error("Failed to call number through connection manager");
            }
          })
          .catch(err => {
            console.error("Error calling number through connection manager:", err);
          });
      }
      
      onCallNumber(number);
      setIsCallingNumber(false);
    }, 1000);
  };

  // Helper function to calculate the called numbers based on the remaining numbers
  // and the currently called number
  const getCalledNumbersFromRemaining = (calledNumber: number, remaining: number[]): number[] => {
    // Create a full range of numbers based on game type (75-ball or 90-ball)
    const maxNumber = gameType === '75-ball' ? 75 : 90;
    const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
    
    // Filter out the remaining numbers to get previously called numbers
    const previouslyCalled = allNumbers.filter(n => !remaining.includes(n));
    
    // Add the current called number if it's not already in the list
    if (!previouslyCalled.includes(calledNumber)) {
      return [...previouslyCalled, calledNumber];
    }
    
    return previouslyCalled;
  };

  const handleGoLiveClick = async () => {
    setIsGoingLive(true);
    try {
      if (callerHub.isConnected) {
        logWithTimestamp("Broadcasting game start via realtime");
        callerHub.startGame();
      }
      
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

  const handleBellClick = () => {
    openClaimSheet();
  };

  const handleCloseGame = () => {
    setIsClosingConfirmOpen(true);
  };

  const confirmCloseGame = () => {
    if (onCloseGame) {
      onCloseGame();
    }
    setIsClosingConfirmOpen(false);
  };
  
  const handleForceClose = () => {
    setIsForceCloseConfirmOpen(true);
  };
  
  const confirmForceClose = () => {
    if (onForceClose) {
      onForceClose();
    }
    setIsForceCloseConfirmOpen(false);
  };
  
  const handleReconnectClick = () => {
    if (callerHub.reconnect) {
      callerHub.reconnect();
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the game server...",
      });
    }
  };

  const isLastGame = currentGameNumber >= numberOfGames;
  
  // CRITICAL: Remove ALL conditions that would disable the Go Live button
  // We are setting this to false to ensure it's always enabled
  const isGoLiveDisabled = false;

  // Connection status indicator                        
  const renderConnectionStatus = () => {
    if (callerHub.connectionState !== 'connected') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mt-2">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
            <div className="text-xs text-amber-700">
              {callerHub.connectionState === 'connecting' 
                ? 'Connecting to game server...' 
                : callerHub.connectionState === 'error' 
                  ? 'Failed to connect to game server' 
                  : 'Disconnected from game server'}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 w-full text-xs flex items-center gap-1"
            onClick={handleReconnectClick}
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              <span>Caller Controls</span>
              <Badge className="ml-2" variant={sessionStatus === 'active' ? 'default' : 'outline'}>
                {sessionStatus === 'active' ? 'Live' : 'Pending'}
              </Badge>
              {currentGameNumber && numberOfGames && (
                <Badge className="ml-2" variant="outline">
                  Game {currentGameNumber} of {numberOfGames}
                </Badge>
              )}
              {callerHub.isConnected && (
                <Badge className="ml-2 bg-green-500 text-white">
                  Connected
                </Badge>
              )}
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
              disabled={isCallingNumber || remainingNumbers.length === 0 || sessionStatus !== 'active' || !callerHub.isConnected || claimCount > 0}
              onClick={handleCallNumber}
            >
              {claimCount > 0 ? 'Review Claims First' : (isCallingNumber ? 'Calling...' : 'Call Next Number')}
            </Button>
            
            {claimCount > 0 && (
              <p className="text-xs text-red-600 text-center">
                You must verify all pending claims before calling more numbers
              </p>
            )}
            
            {onCloseGame && (
              <Button
                variant="secondary"
                onClick={handleCloseGame}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastGame ? 'Complete Session' : 'Close Game'}
              </Button>
            )}
            
            {/* Add FORCE close button */}
            {onForceClose && (
              <Button
                variant="outline"
                onClick={handleForceClose}
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                {isLastGame ? 'FORCE Complete Session' : 'FORCE Close Game'}
              </Button>
            )}
            
            <Button 
              variant="destructive"
              onClick={onEndGame}
            >
              End Game
            </Button>
            
            <GoLiveButton
              sessionId={sessionId}
              disabled={false}
              className="w-full"
              onSuccess={() => {
                handleGoLiveClick();
              }}
            >
              Go Live
            </GoLiveButton>
          </div>
          
          {renderConnectionStatus()}
        </CardContent>
      </Card>

      <AlertDialog 
        open={isClosingConfirmOpen} 
        onOpenChange={setIsClosingConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLastGame ? 'Complete Session?' : 'Close Game?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLastGame 
                ? 'This will mark the session as completed. This action cannot be undone.' 
                : 'This will close the current game and advance to the next one. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCloseGame}
              className={isLastGame ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isLastGame ? 'Complete Session' : 'Close Game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Force Close Confirmation Dialog */}
      <AlertDialog 
        open={isForceCloseConfirmOpen} 
        onOpenChange={setIsForceCloseConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {isLastGame ? 'FORCE Complete Session?' : 'FORCE Close Game?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLastGame 
                ? 'This will FORCE complete the session, resetting all game data. This action cannot be undone and may disrupt active players.' 
                : 'This will FORCE close the current game, reset all numbers, and advance to the next one. This action cannot be undone and may disrupt active players.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmForceClose}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLastGame ? 'FORCE Complete' : 'FORCE Close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
