
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DEFAULT_PATTERN_ORDER } from '@/types';
import { GameType } from '@/types/winPattern';

interface WinPatternStatusDisplayProps {
  gameType: GameType;
  activePatternId: string | null;
  completedPatternIds?: string[];
}

export function WinPatternStatusDisplay({ 
  gameType,
  activePatternId,
  completedPatternIds = []
}: WinPatternStatusDisplayProps) {
  // Use DEFAULT_PATTERN_ORDER from types
  const patternOrder = DEFAULT_PATTERN_ORDER[gameType] || [];
  
  const patternNames: Record<string, string> = {
    'oneLine': 'One Line',
    'twoLines': 'Two Lines',
    'fullHouse': 'Full House',
    'corners': 'Corners',
    'threeLines': 'Three Lines',
    'coverAll': 'Cover All'
  };
  
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-2">Win Patterns</h3>
      <div className="flex flex-wrap gap-2">
        {patternOrder.map(patternId => {
          const isActive = activePatternId === patternId;
          const isCompleted = completedPatternIds.includes(patternId);
          
          let variant: 'outline' | 'secondary' | 'default' = 'outline';
          if (isActive) variant = 'default';
          else if (isCompleted) variant = 'secondary';
          
          return (
            <Badge key={patternId} variant={variant}>
              {patternNames[patternId] || patternId}
            </Badge>
          );
        })}
      </div>
    </Card>
  );
}
