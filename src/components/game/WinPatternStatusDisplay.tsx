
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { GameType } from '@/types';
import { normalizeWinPattern, getWinPatternDisplayName } from '@/utils/winPatternUtils';

interface WinPatternStatusDisplayProps {
  gameType?: GameType;
  activePatternId?: string | null;
  completedPatternIds?: string[];
  // Add new props for LiveGameView compatibility
  patterns?: { id: string; name: string; active: boolean; }[];
  currentActive?: string | null;
  gameIsLive?: boolean;
}

export function WinPatternStatusDisplay({ 
  gameType = 'mainstage',
  activePatternId,
  completedPatternIds = [],
  // New props
  patterns,
  currentActive,
  gameIsLive
}: WinPatternStatusDisplayProps) {
  // If using new pattern format
  if (patterns && Array.isArray(patterns)) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-2">Win Patterns</h3>
        <div className="flex flex-wrap gap-2">
          {patterns.map(pattern => {
            const normalizedId = normalizeWinPattern(pattern.id, gameType);
            const isActive = normalizeWinPattern(currentActive, gameType) === normalizedId;
            const isCompleted = pattern.active && !isActive;
            
            let variant: 'outline' | 'secondary' | 'default' = 'outline';
            if (isActive) variant = 'default';
            else if (isCompleted) variant = 'secondary';
            
            return (
              <Badge key={pattern.id} variant={variant}>
                {pattern.name || getWinPatternDisplayName(pattern.id)}
              </Badge>
            );
          })}
        </div>
      </Card>
    );
  }
  
  // Legacy pattern order support
  const patternOrder = gameType ? getDefaultPatternsForType(gameType) : ['oneLine', 'twoLines', 'fullHouse'];
  
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-2">Win Patterns</h3>
      <div className="flex flex-wrap gap-2">
        {patternOrder.map(patternId => {
          const normalizedId = normalizeWinPattern(patternId, gameType);
          const isActive = normalizeWinPattern(activePatternId, gameType) === normalizedId;
          const isCompleted = completedPatternIds.includes(normalizedId) || completedPatternIds.includes(patternId);
          
          let variant: 'outline' | 'secondary' | 'default' = 'outline';
          if (isActive) variant = 'default';
          else if (isCompleted) variant = 'secondary';
          
          return (
            <Badge key={patternId} variant={variant}>
              {getWinPatternDisplayName(patternId)}
            </Badge>
          );
        })}
      </div>
    </Card>
  );
}

// Helper function to get default patterns based on game type
function getDefaultPatternsForType(gameType: GameType): string[] {
  switch (gameType) {
    case 'party':
      return ['corners', 'oneLine', 'twoLines', 'threeLines', 'fullHouse'];
    case 'quiz':
    case 'music':
    case 'logo':
    case 'mainstage':
    case '90ball':
      return ['oneLine', 'twoLines', 'fullHouse'];
    case '75ball':
      return ['oneLine', 'coverAll'];
    case 'speed':
      return ['oneLine', 'fullHouse'];
    default:
      return ['oneLine', 'twoLines', 'fullHouse'];
  }
}
