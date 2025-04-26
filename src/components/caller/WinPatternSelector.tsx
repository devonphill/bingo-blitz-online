
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
  
  // This function directly handles the input change event
  const handlePrizeInputChange = (patternId: string, value: string) => {
    console.log(`Prize change attempt for ${patternId}: "${value}"`);
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
                    <Label htmlFor={`prize-${pattern.id}`} className="sr-only">
                      Prize for {pattern.name}
                    </Label>
                    <Input
                      id={`prize-${pattern.id}`}
                      type="text"
                      placeholder="Enter prize"
                      value={prizes[pattern.id] || ''}
                      onChange={(e) => handlePrizeInputChange(pattern.id, e.target.value)}
                      className="w-full"
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
