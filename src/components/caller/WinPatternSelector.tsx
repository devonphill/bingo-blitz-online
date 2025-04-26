
import React from 'react';
import { WinPattern } from '@/types/winPattern';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PrizeDetails } from '@/types';

interface WinPatternSelectorProps {
  patterns: WinPattern[];
  selectedPatterns: string[];
  onPatternSelect?: (pattern: WinPattern) => void;
  prizes?: { [patternId: string]: PrizeDetails };
  onPrizeChange?: (patternId: string, prizeDetails: PrizeDetails) => void;
}

export function WinPatternSelector({ 
  patterns, 
  selectedPatterns,
  onPatternSelect,
  prizes = {},
  onPrizeChange
}: WinPatternSelectorProps) {
  
  const handlePrizeChange = (patternId: string, field: keyof PrizeDetails, value: string | boolean) => {
    if (!onPrizeChange) return;
    
    const currentPrize = prizes[patternId] || { amount: '', isNonCash: false, description: '' };
    const updatedPrize = {
      ...currentPrize,
      [field]: value
    };
    
    console.log(`Prize change for ${patternId}:`, updatedPrize);
    onPrizeChange(patternId, updatedPrize);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Win Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              Please select a game type to see available win patterns
            </div>
          ) : (
            patterns.map((pattern) => (
              <div 
                key={pattern.id} 
                className={`flex items-start justify-between p-3 rounded-lg border ${
                  selectedPatterns.includes(pattern.id) ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex flex-col w-full gap-4">
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => onPatternSelect && onPatternSelect(pattern)}
                      variant={selectedPatterns.includes(pattern.id) ? 'default' : 'outline'}
                      disabled={!pattern.available}
                      className="min-w-[100px]"
                    >
                      {pattern.name}
                    </Button>
                  </div>
                  
                  {selectedPatterns.includes(pattern.id) && (
                    <div className="flex flex-col gap-4 pl-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-xs">
                          <Label htmlFor={`prize-${pattern.id}`}>Prize Amount</Label>
                          <Input
                            id={`prize-${pattern.id}`}
                            type="text"
                            placeholder="Enter prize amount"
                            value={prizes[pattern.id]?.amount || ''}
                            onChange={(e) => handlePrizeChange(pattern.id, 'amount', e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`nonCash-${pattern.id}`}
                            checked={prizes[pattern.id]?.isNonCash || false}
                            onCheckedChange={(checked) => 
                              handlePrizeChange(pattern.id, 'isNonCash', checked === true)
                            }
                          />
                          <Label htmlFor={`nonCash-${pattern.id}`}>Non-Cash Prize</Label>
                        </div>
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`description-${pattern.id}`}>Prize Description</Label>
                        <Textarea
                          id={`description-${pattern.id}`}
                          placeholder="Enter prize description"
                          value={prizes[pattern.id]?.description || ''}
                          onChange={(e) => handlePrizeChange(pattern.id, 'description', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
