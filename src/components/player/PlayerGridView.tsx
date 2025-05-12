
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CalledNumbers from '@/components/game/CalledNumbers';

interface PlayerGridViewProps {
  calledNumbers: number[];
  lastCalledNumber: number | null;
  gameType: string;
}

export default function PlayerGridView({
  calledNumbers,
  lastCalledNumber,
  gameType
}: PlayerGridViewProps) {
  const maxNumber = gameType === 'mainstage' ? 90 : gameType === 'party' ? 80 : 75;
  
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Called Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <CalledNumbers 
            calledNumbers={calledNumbers} 
            currentNumber={lastCalledNumber} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
