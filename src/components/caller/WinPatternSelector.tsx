
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  
  // Simplify the handler to directly call the callback
  const handlePrizeChange = (patternId: string, value: string) => {
    console.log(`Prize change for ${patternId}: "${value}"`);
    if (onPrizeChange) {
      onPrizeChange(patternId, value);
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
                  <div className="flex-grow max-w-xs">
                    <input
                      id={`prize-${pattern.id}`}
                      type="text"
                      placeholder="Enter prize"
                      value={prizes[pattern.id] || ''}
                      onChange={(e) => handlePrizeChange(pattern.id, e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Prize for ${pattern.name}`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
