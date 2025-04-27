import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_PATTERN_ORDER } from '@/types';

interface WinPatternStatusDisplayProps {
  patterns: Array<{
    id: string;
    name: string;
    active: boolean;
  }>;
  currentActive: string | null;
  gameIsLive: boolean;
}

export function WinPatternStatusDisplay({ 
  patterns, 
  currentActive,
  gameIsLive
}: WinPatternStatusDisplayProps) {
  // Sort patterns according to standard game progression where possible
  const sortedPatterns = [...patterns].sort((a, b) => {
    // Extract base pattern IDs without prefixes
    const aBaseId = a.id.replace('MAINSTAGE_', '');
    const bBaseId = b.id.replace('MAINSTAGE_', '');
    
    // Try to find these in standard order arrays
    const aIndex = Object.values(DEFAULT_PATTERN_ORDER).findIndex(
      arr => arr.includes(aBaseId)
    );
    const bIndex = Object.values(DEFAULT_PATTERN_ORDER).findIndex(
      arr => arr.includes(bBaseId)
    );
    
    // If both found in same array, compare positions within that array
    if (aIndex !== -1 && bIndex !== -1 && aIndex === bIndex) {
      const orderArray = Object.values(DEFAULT_PATTERN_ORDER)[aIndex];
      return orderArray.indexOf(aBaseId) - orderArray.indexOf(bBaseId);
    }
    
    // Otherwise sort by active status first, then by name
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    
    return a.name.localeCompare(b.name);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Current Win Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {sortedPatterns.map((pattern, index) => (
            <Button
              key={pattern.id}
              variant="outline"
              size="sm"
              disabled={!pattern.active}
              className={`
                ${!pattern.active ? 'opacity-50' : ''}
                ${(gameIsLive && pattern.id === currentActive) 
                  ? 'bg-green-100 border-green-500 text-green-700' 
                  : ''}
                ${pattern.active && 'relative'}
              `}
            >
              {pattern.name}
              {pattern.active && index > 0 && (
                <span className="absolute -top-2 -right-2 h-4 w-4 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                  {index + 1}
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
