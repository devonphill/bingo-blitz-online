
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
                    placeholder="Enter prize"
                    value={prizes[pattern.id] || ''}
                    onChange={(e) => onPrizeChange && onPrizeChange(pattern.id, e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-xs"
                    aria-label={`Prize for ${pattern.name}`}
                    type="text"
                    autoComplete="off"
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
