
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Current Win Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {patterns.map((pattern) => (
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
              `}
            >
              {pattern.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
