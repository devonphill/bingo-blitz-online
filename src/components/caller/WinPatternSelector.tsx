
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
  console.log("WinPatternSelector - prizes:", prizes);
  console.log("WinPatternSelector - selectedPatterns:", selectedPatterns);
  
  const handlePrizeChange = (patternId: string, field: keyof PrizeDetails, value: string | boolean) => {
    if (!onPrizeChange) {
      console.log("No onPrizeChange handler provided");
      return;
    }
    
    // Always clone the current prize object or create a new one
    const currentPrize = prizes[patternId] || { amount: '', isNonCash: false, description: '' };
    
    // Create a completely new object to ensure React detects the change
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
            patterns.map((pattern) => {
              const patternId = String(pattern.id);
              const isSelected = selectedPatterns.includes(patternId);
              
              return (
                <div 
                  key={patternId} 
                  className={`flex items-start justify-between p-3 rounded-lg border ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col w-full gap-4">
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={() => onPatternSelect && onPatternSelect(pattern)}
                        variant={isSelected ? 'default' : 'outline'}
                        disabled={!pattern.available}
                        className="min-w-[100px]"
                      >
                        {pattern.name}
                      </Button>
                    </div>
                    
                    {isSelected && (
                      <div className="flex flex-col gap-4 pl-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 max-w-xs">
                            <Label htmlFor={`prize-${patternId}`}>Prize Amount</Label>
                            <Input
                              id={`prize-${patternId}`}
                              type="text"
                              placeholder="Enter prize amount"
                              value={prizes[patternId]?.amount || ''}
                              onChange={(e) => handlePrizeChange(patternId, 'amount', e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`nonCash-${patternId}`}
                              checked={prizes[patternId]?.isNonCash || false}
                              onCheckedChange={(checked) => 
                                handlePrizeChange(patternId, 'isNonCash', checked === true)
                              }
                            />
                            <Label htmlFor={`nonCash-${patternId}`}>Non-Cash Prize</Label>
                          </div>
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`description-${patternId}`}>Prize Description</Label>
                          <Textarea
                            id={`description-${patternId}`}
                            placeholder="Enter prize description"
                            value={prizes[patternId]?.description || ''}
                            onChange={(e) => handlePrizeChange(patternId, 'description', e.target.value)}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
