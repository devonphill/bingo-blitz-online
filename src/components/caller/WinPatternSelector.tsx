
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
                  <Input
                    placeholder="Enter prize"
                    value={prizes[pattern.id] || ''}
                    onChange={(e) => onPrizeChange && onPrizeChange(pattern.id, e.target.value)}
                    className="w-full max-w-xs"
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
