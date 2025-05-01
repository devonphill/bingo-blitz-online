import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bell, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCallerHub } from '@/hooks/useCallerHub';
import { logWithTimestamp } from '@/utils/logUtils';
import { GoLiveButton } from '@/components/ui/go-live-button';

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
  onCloseGame,
  numberOfGames = 1,
  currentGameNumber = 1
}: CallerControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isClosingConfirmOpen, setIsClosingConfirmOpen] = useState(false);
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
  
  // Fix the condition for Go Live button
  // Only disable if going live, no win patterns, already active, or no connection
  const isGoLiveDisabled = isGoingLive || 
                          winPatterns.length === 0 || 
                          sessionStatus === 'active';

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
              disabled={isCallingNumber || remainingNumbers.length === 0 || sessionStatus !== 'active' || !callerHub.isConnected}
              onClick={handleCallNumber}
            >
              {isCallingNumber ? 'Calling...' : 'Call Next Number'}
            </Button>
            
            {onCloseGame && (
              <Button
                variant="secondary"
                onClick={handleCloseGame}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastGame ? 'Complete Session' : 'Close Game'}
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
              disabled={isGoLiveDisabled}
              className="w-full"
              onSuccess={() => {
                handleGoLiveClick();
              }}
            >
              {callerHub.connectionState !== 'connected' ? 'Connect First' : 'Go Live'}
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
    </>
  );
}
