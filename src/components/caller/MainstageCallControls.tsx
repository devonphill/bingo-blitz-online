
import React from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GameSession } from '@/types';
import { Badge } from "@/components/ui/badge";

interface MainstageCallControlsProps {
  onCallNumber: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
  sessionStatus?: string;
  onCloseGame?: () => void;
  currentGameNumber?: number;
  numberOfGames?: number;
  activeWinPatterns: string[];
  currentSession: {id?: string};
  prizesInfo?: {
    amount?: string;
    description?: string;
    isNonCash?: boolean;
  }[];
}

export function MainstageCallControls({
  onCallNumber,
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims,
  sessionStatus = 'pending',
  onCloseGame,
  currentGameNumber = 1,
  numberOfGames = 1,
  activeWinPatterns,
  currentSession,
  prizesInfo = []
}: MainstageCallControlsProps) {
  const isGameActive = sessionStatus === 'active';
  const isGameCompleted = sessionStatus === 'completed';
  const hasMoreGames = currentGameNumber < numberOfGames;
  
  // Format pattern names for display
  const getPatternDisplayName = (patternId: string) => {
    const normalizedId = patternId.replace('MAINSTAGE_', '');
    
    switch(normalizedId) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      default: return patternId;
    }
  };

  const currentPatternDisplay = activeWinPatterns.length > 0 ? 
    getPatternDisplayName(activeWinPatterns[0]) : 'None';
    
  // Get prize information for the current pattern
  const currentPrizeInfo = activeWinPatterns.length > 0 && prizesInfo && prizesInfo[0] ? 
    prizesInfo[0] : null;

  return (
    <Card className="bg-white shadow-md rounded-lg">
      <CardHeader className="space-y-1 p-4">
        <CardTitle className="text-lg font-semibold">Game Controls</CardTitle>
        <CardDescription>Manage the game flow and view session details.</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Current Game:</span>
            <span className="font-medium">{currentGameNumber} / {numberOfGames}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total Calls:</span>
            <span className="font-medium">{totalCalls}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last Called:</span>
            <span className="font-medium">{lastCalledNumber !== null ? lastCalledNumber : 'None'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>Current Pattern:</span>
              <Badge className="font-medium bg-green-600">{currentPatternDisplay}</Badge>
            </div>
            {currentPrizeInfo && (
              <div className="mt-1 px-2 py-1 bg-gray-50 rounded-md text-sm">
                <div className="font-semibold">{currentPrizeInfo.description || 'Prize'}</div>
                <div>{currentPrizeInfo.isNonCash ? 'Non-Cash Prize' : 
                  (currentPrizeInfo.amount ? `£${currentPrizeInfo.amount}` : '')}</div>
              </div>
            )}
            {activeWinPatterns.length > 1 && (
              <div className="text-xs text-gray-500">
                Next patterns: {activeWinPatterns.slice(1).map(getPatternDisplayName).join(', ')}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Pending Claims:</span>
            <span className="font-medium">{pendingClaims}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4">
        <div className="space-x-2">
          {isGameActive && (
            <Button 
              variant="default" 
              onClick={onCallNumber} 
              disabled={isGameCompleted}
              className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            >
              Call Number
            </Button>
          )}
          {pendingClaims > 0 && (
            <Button onClick={onViewClaims}>
              View Claims ({pendingClaims})
            </Button>
          )}
        </div>
        <div>
          {onCloseGame && (
            <Button variant="destructive" onClick={onCloseGame} disabled={!isGameActive && !isGameCompleted}>
              {isGameCompleted ? 'Close Game' : 'End Game'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
