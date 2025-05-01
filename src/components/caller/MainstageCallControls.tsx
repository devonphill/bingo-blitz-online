
import React from 'react';
import { Button } from "@/components/ui/button";
import { Loader } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrizeDetails } from '@/types';
import { useCallerHub } from '@/hooks/useCallerHub';

interface MainstageCallControlsProps {
  onCallNumber: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
  sessionStatus?: string;
  onCloseGame?: () => void;
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
  activeWinPatterns = [],
  currentGameNumber = 1,
  numberOfGames = 1,
  currentSession,
  prizesInfo = []
}: MainstageCallControlsProps) {
  // Display the current win pattern in a more human-readable format
  const formatWinPattern = (patternId: string): string => {
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
  const isConnected = callerHub.isConnected;

  const nextPatterns = getNextPatterns();
  const currentPattern = activeWinPatterns.length > 0 ? formatWinPattern(activeWinPatterns[0]) : 'None';
  const nextPatternsText = nextPatterns.length > 0 ? nextPatterns.join(', ') : 'None';
  
  // Get the prize info for the current pattern
  const currentPrize = prizesInfo && prizesInfo.length > 0 ? prizesInfo[0] : null;
  const prizeDisplay = currentPrize ? 
    (currentPrize.isNonCash ? currentPrize.description : `£${currentPrize.amount}`) : 'Not set';
  
  return (
    <Card className="shadow">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Game Controls</span>
          {isConnected ? (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Connected</span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
              {callerHub.connectionState === 'connecting' ? 'Connecting...' : 'Not Connected'}
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
            disabled={sessionStatus !== 'active' || !isConnected}
          >
            {!isConnected ? "Reconnect Required" : 
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
        </div>
      </CardContent>
    </Card>
  );
}
