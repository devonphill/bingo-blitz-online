
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WinPatternSelectorProps {
  patterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect?: (pattern: WinPattern) => void;
  prizes?: { [patternId: string]: string };
  onPrizeChange?: (patternId: string, prize: string) => void;
}

export function WinPatternSelector({ 
  patterns, 
  selectedPatterns,
  onPatternSelect,
  prizes = {},
  onPrizeChange
}: WinPatternSelectorProps) {
  // Create a handler for input changes
  const handlePrizeChange = (patternId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (onPrizeChange) {
      onPrizeChange(patternId, e.target.value);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Win Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div 
              key={pattern.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                selectedPatterns.includes(pattern.id) ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-4 w-full">
                <Button
                  onClick={() => onPatternSelect && onPatternSelect(pattern)}
                  variant={selectedPatterns.includes(pattern.id) ? 'default' : 'outline'}
                  disabled={!pattern.available}
                  className="min-w-[100px]"
                >
                  {pattern.name}
                </Button>
                
                {selectedPatterns.includes(pattern.id) && (
                  <input
                    type="text"
                    placeholder="Enter prize"
                    value={prizes[pattern.id] || ''}
                    onChange={(e) => handlePrizeChange(pattern.id, e)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-xs"
                    aria-label={`Prize for ${pattern.name}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
