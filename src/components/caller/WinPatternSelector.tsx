
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WinPatternSelectorProps {
  patterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect?: (pattern: WinPattern) => void;
}

export function WinPatternSelector({ 
  patterns, 
  selectedPatterns,
  onPatternSelect 
}: WinPatternSelectorProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Win Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4">
          {patterns.map((pattern) => (
            <Button
              key={pattern.id}
              onClick={() => onPatternSelect && onPatternSelect(pattern)}
              variant={selectedPatterns.includes(pattern.id) ? 'default' : 'outline'}
              className="w-full"
              disabled={!pattern.available}
            >
              {pattern.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
