import React from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GameSession } from '@/types';

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
  currentSession
}: MainstageCallControlsProps) {
  const isGameActive = sessionStatus === 'active';
  const isGameCompleted = sessionStatus === 'completed';
  const hasMoreGames = currentGameNumber < numberOfGames;

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
          <div className="flex items-center justify-between">
            <span>Active Patterns:</span>
            <span className="font-medium">{activeWinPatterns.join(', ') || 'None'}</span>
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
            <Button variant="outline" onClick={onCallNumber} disabled={isGameCompleted}>
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
