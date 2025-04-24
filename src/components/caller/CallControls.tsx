
import React from 'react';
import { GameType } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CallControlsProps {
  gameType: GameType;
  onCallNumber: () => void;
  onRecall: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
}

export function CallControls({
  gameType,
  onCallNumber,
  onRecall,
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims
}: CallControlsProps) {
  if (gameType !== 'mainstage') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <p className="text-lg font-semibold">
              {gameType.charAt(0).toUpperCase() + gameType.slice(1)} Bingo
            </p>
            <p className="text-sm text-gray-500">Controls coming soon</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Call Controls</CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="relative"
          onClick={onViewClaims}
        >
          <Bell className="h-4 w-4" />
          {pendingClaims > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
              {pendingClaims}
            </Badge>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold">
            {lastCalledNumber || '-'}
          </div>
          <div className="text-sm text-gray-500">
            Last Called Number
          </div>
        </div>
        
        <div className="text-center mb-4">
          <span className="text-sm text-gray-500">Total Calls: </span>
          <span className="font-semibold">{totalCalls}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button onClick={onCallNumber} className="w-full">
            Call Number
          </Button>
          <Button onClick={onRecall} variant="outline" className="w-full">
            Recall
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
