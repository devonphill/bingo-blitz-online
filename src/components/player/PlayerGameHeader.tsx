
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';

interface PlayerGameHeaderProps {
  sessionName: string;
  callerName: string;
  lastNumber?: number | null;
  timestamp?: number | null;
  gameType?: string;
  pattern?: string;
}

export default function PlayerGameHeader({
  sessionName,
  callerName,
  lastNumber,
  timestamp,
  gameType = 'mainstage',
  pattern = 'No pattern'
}: PlayerGameHeaderProps) {
  return (
    <Card className="mb-4 border-b shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{sessionName}</h2>
            <Badge variant="outline">{gameType}</Badge>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>Caller: {callerName}</div>
            <div>Pattern: {pattern}</div>
          </div>
          {lastNumber && (
            <div className="flex justify-between items-center">
              <div className="text-sm">Last called: <strong className="text-lg">{lastNumber}</strong></div>
              {timestamp && (
                <div className="text-xs text-gray-500">
                  {new Date(timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
