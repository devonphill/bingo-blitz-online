import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader, RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrizeDetails } from '@/types';
import { useCallerHub } from '@/hooks/useCallerHub';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface MainstageCallControlsProps {
  onCallNumber: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
  sessionStatus?: string;
  onCloseGame?: () => void;
  onForceClose?: () => void; // New prop for force close functionality
  activeWinPatterns?: string[];
  currentGameNumber?: number;
  numberOfGames?: number;
  currentSession?: { id: string | undefined };
  prizesInfo?: PrizeDetails[];
}

export function MainstageCallControls({ 
  onCallNumber, 
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims,
  sessionStatus = 'active',
  onCloseGame,
  onForceClose, // New prop
  activeWinPatterns = [],
  currentGameNumber = 1,
  numberOfGames = 1,
  currentSession,
  prizesInfo = []
}: MainstageCallControlsProps) {
  const { toast } = useToast();
  const [isForceCloseConfirmOpen, setIsForceCloseConfirmOpen] = useState(false);
  
  // Display the current win pattern in a more human-readable format
  const formatWinPattern = (patternId: string): string => {
    if (!patternId) return 'Not Set';
    
    switch(patternId.replace('MAINSTAGE_', '')) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      case 'pattern': return 'Pattern';
      case 'blackout': return 'Blackout';
      default: return patternId;
    }
  };
  
  // Get next patterns based on the current active pattern
  const getNextPatterns = (): string[] => {
    const defaultPatterns = ['oneLine', 'twoLines', 'fullHouse'];
    if (activeWinPatterns.length === 0) return [];
    
    const currentPattern = activeWinPatterns[0].replace('MAINSTAGE_', '');
    const currentIndex = defaultPatterns.indexOf(currentPattern);
    
    if (currentIndex === -1 || currentIndex === defaultPatterns.length - 1) {
      return [];
    }
    
    return defaultPatterns.slice(currentIndex + 1).map(formatWinPattern);
  };

  // Get connection status from the caller hub
  const callerHub = useCallerHub(currentSession?.id);
  
  // Add a debounced actual connection state
  const [isActuallyConnected, setIsActuallyConnected] = useState(callerHub.isConnected);
  
  // Debounce connection state to avoid flashing
  useEffect(() => {
    // Immediately update to connected state for good UX
    if (callerHub.connectionState === 'connected') {
      setIsActuallyConnected(true);
      return;
    }
    
    // For disconnection states, use a debounce
    const timer = setTimeout(() => {
      setIsActuallyConnected(callerHub.connectionState === 'connected');
    }, 3000); // 3 second debounce for stability
    
    return () => clearTimeout(timer);
  }, [callerHub.connectionState]);

  // Debug logging for connection status
  useEffect(() => {
    logWithTimestamp(`MainstageCallControls: connection state: ${callerHub.connectionState}, isConnected: ${callerHub.isConnected}, isActuallyConnected: ${isActuallyConnected}`);
  }, [callerHub.connectionState, callerHub.isConnected, isActuallyConnected]);

  const handleForceClose = () => {
    setIsForceCloseConfirmOpen(true);
  };
  
  const confirmForceClose = () => {
    if (onForceClose) {
      onForceClose();
    }
    setIsForceCloseConfirmOpen(false);
  };

  const nextPatterns = getNextPatterns();
  const currentPattern = activeWinPatterns.length > 0 ? formatWinPattern(activeWinPatterns[0]) : 'None';
  const nextPatternsText = nextPatterns.length > 0 ? nextPatterns.join(', ') : 'None';
  
  // Get the prize info for the current pattern
  const currentPrize = prizesInfo && prizesInfo.length > 0 ? prizesInfo[0] : null;
  const prizeDisplay = currentPrize ? 
    (currentPrize.isNonCash ? currentPrize.description : `£${currentPrize.amount}`) : 'Not set';

  const handleReconnectClick = () => {
    if (callerHub.reconnect) {
      callerHub.reconnect();
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to the game server...",
      });
    }
  };
  
  // Use the actual connection state for display consistency
  const displayConnectionState = isActuallyConnected ? 'connected' : callerHub.connectionState;
  
  return (
    
    <Card className="shadow">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Game Controls</span>
          {isActuallyConnected ? (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Connected</span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
              {displayConnectionState === 'connecting' ? 'Connecting...' : 'Not Connected'}
            </span>
          )}
        </CardTitle>
        <CardDescription>Manage the game flow and view session details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500">Current Game:</p>
            <p className="text-lg font-medium">{currentGameNumber} / {numberOfGames}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500">Total Calls:</p>
            <p className="text-lg font-medium">{totalCalls}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500">Last Called:</p>
            <p className="text-lg font-medium">{lastCalledNumber !== null ? lastCalledNumber : 'None'}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-500">Pending Claims:</p>
            <p className="text-lg font-medium">{pendingClaims}</p>
          </div>
        </div>
        
        
        <div className="bg-gray-50 p-4 rounded-md mt-4">
          <p className="text-sm text-gray-500">Current Pattern:</p>
          <p className="text-lg font-medium">{currentPattern}</p>
          {nextPatterns.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Next patterns: {nextPatternsText}
            </p>
          )}
          {currentPrize && (
            <div className="mt-2">
              <p className="text-sm text-gray-500">Prize:</p>
              <p className="text-lg font-medium">{prizeDisplay}</p>
              {currentPrize.description && !currentPrize.isNonCash && (
                <p className="text-sm text-gray-700 mt-1">{currentPrize.description}</p>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-2 pt-4">
          <Button 
            onClick={onCallNumber} 
            className="w-full" 
            size="lg"
            disabled={sessionStatus !== 'active' || !isActuallyConnected}
          >
            {!isActuallyConnected ? "Reconnect Required" : 
              sessionStatus === 'active' ? "Call Next Number" : "Game Paused"}
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={onViewClaims}
              variant="secondary" 
              className={pendingClaims > 0 ? "bg-amber-100 hover:bg-amber-200" : ""}
            >
              {pendingClaims > 0 ? (
                <span className="flex items-center">
                  <Loader className="animate-spin mr-2 h-4 w-4" />
                  View Claims ({pendingClaims})
                </span>
              ) : "View Claims"}
            </Button>
            
            {onCloseGame && (
              <Button 
                onClick={onCloseGame} 
                variant="outline"
              >
                Close Game
              </Button>
            )}
          </div>
          
          {/* Add FORCE close button */}
          {onForceClose && (
            <Button
              onClick={handleForceClose}
              variant="outline"
              className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              FORCE Close Game
            </Button>
          )}
        </div>

        {/* Add reconnect button if not connected */}
        {!isActuallyConnected && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md p-2">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
              <div className="text-xs text-amber-700">
                {displayConnectionState === 'connecting' 
                  ? 'Connecting to game server...' 
                  : displayConnectionState === 'error' 
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
        )}
      </CardContent>
      
      {/* Force Close Confirmation Dialog */}
      <AlertDialog 
        open={isForceCloseConfirmOpen} 
        onOpenChange={setIsForceCloseConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {currentGameNumber === numberOfGames ? 'FORCE Complete Session?' : 'FORCE Close Game?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentGameNumber === numberOfGames 
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
              {currentGameNumber === numberOfGames ? 'FORCE Complete' : 'FORCE Close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
