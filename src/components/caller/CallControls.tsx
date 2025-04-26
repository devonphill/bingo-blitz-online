
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, PlayCircle, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GameType } from '@/types';

interface CallControlsProps {
  onCallNumber: () => void;
  onRecall: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
  gameType?: GameType;
  sessionStatus?: string;
}

export function CallControls({
  onCallNumber,
  onRecall,
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims,
  gameType = 'mainstage',
  sessionStatus = 'pending'
}: CallControlsProps) {
  const gameActive = sessionStatus === 'active';
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Call Controls</span>
          <Badge variant={gameActive ? "default" : "outline"}>
            {gameActive ? "Live" : "Pending"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-md border border-gray-200 p-4 text-center">
            <div className="text-sm text-gray-500">Last Call</div>
            <div className="text-3xl font-bold mt-1">{lastCalledNumber || '-'}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-4 text-center">
            <div className="text-sm text-gray-500">Total Calls</div>
            <div className="text-3xl font-bold mt-1">{totalCalls}</div>
          </div>
        </div>

        <Button 
          onClick={onCallNumber}
          disabled={!gameActive}
          className="w-full h-14 text-lg" 
          variant={gameActive ? "default" : "outline"}
        >
          <PlayCircle className="mr-2 h-5 w-5" />
          Call Number
        </Button>
        
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={onRecall}
            disabled={!lastCalledNumber || !gameActive}
            variant="outline" 
            className="w-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Recall
          </Button>
          
          <Button 
            onClick={onViewClaims}
            variant={pendingClaims > 0 ? "destructive" : "outline"}
            className="w-full"
          >
            <Bell className="mr-2 h-4 w-4" />
            {pendingClaims > 0 ? `Claims (${pendingClaims})` : 'View Claims'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
