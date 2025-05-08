
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NumberPad from './NumberPad';
import { X, AlertOctagon } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkStatusContext';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  winPatterns: string[];
  claimCount: number;
  openClaimSheet: () => void;
  gameType?: string;
  sessionStatus?: string;
  gameConfigs?: any[];
  onForceClose?: () => void;
  disableCallButton?: boolean; // Add prop to disable call button when claims are pending
}

export default function CallerControls({
  onCallNumber,
  onEndGame,
  onGoLive,
  remainingNumbers,
  sessionId,
  winPatterns,
  claimCount,
  openClaimSheet,
  gameType = 'mainstage',
  sessionStatus,
  gameConfigs,
  onForceClose,
  disableCallButton = false
}: CallerControlsProps) {
  const [isRandom, setIsRandom] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Get the network context to help with calling numbers
  const network = useNetwork();
  
  // Handle manually selecting a number
  const handleNumberSelect = (number: number) => {
    setSelectedNumber(number);
    setIsRandom(false);
  };
  
  // Handle calling the selected number
  const handleCallNumber = async () => {
    setIsLoading(true);
    try {
      if (isRandom) {
        if (remainingNumbers.length === 0) {
          console.error("No remaining numbers to call");
          return;
        }
        
        // Select a random number from the remaining numbers
        const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
        const randomNumber = remainingNumbers[randomIndex];
        
        onCallNumber(randomNumber);
      } else if (selectedNumber !== null) {
        onCallNumber(selectedNumber);
        setSelectedNumber(null);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine if the button should be disabled
  const isCallButtonDisabled = isLoading || 
                              remainingNumbers.length === 0 ||
                              disableCallButton || // Disable when claims are pending
                              sessionStatus !== 'active';

  return (
    <Card ref={cardRef}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Caller Controls</span>
          {claimCount > 0 && (
            <Button 
              size="sm" 
              variant="destructive" 
              className="animate-pulse flex items-center gap-1"
              onClick={openClaimSheet}
            >
              <AlertOctagon className="h-4 w-4" />
              <span>{claimCount} {claimCount === 1 ? 'Claim' : 'Claims'}</span>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Next number controls */}
          <div className="bg-gray-100 p-4 rounded-md">
            <h3 className="text-sm font-medium mb-3">Next Number</h3>
            
            <div className="flex space-x-2 mb-4">
              <Button
                variant={isRandom ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setIsRandom(true)}
              >
                Random
              </Button>
              <Button
                variant={!isRandom ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setIsRandom(false)}
              >
                Manual
              </Button>
            </div>
            
            {!isRandom && (
              <div className="mb-4">
                <NumberPad
                  onNumberSelect={handleNumberSelect}
                  selectedNumber={selectedNumber}
                  availableNumbers={remainingNumbers}
                  gameType={gameType}
                />
              </div>
            )}
            
            <Button
              className="w-full"
              onClick={handleCallNumber}
              disabled={isCallButtonDisabled}
            >
              {disableCallButton && claimCount > 0 ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Review Claims First
                </>
              ) : isRandom ? (
                isLoading ? 'Calling...' : 'Call Next Number'
              ) : (
                isLoading ? 'Calling...' : selectedNumber ? `Call ${selectedNumber}` : 'Select a Number'
              )}
            </Button>
            
            {disableCallButton && claimCount > 0 && (
              <p className="text-xs text-red-600 mt-2 text-center">
                You must verify all pending claims before calling more numbers
              </p>
            )}
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              {remainingNumbers.length} numbers remaining
            </p>
          </div>
          
          {/* Game controls */}
          <div className="bg-gray-100 p-4 rounded-md">
            <h3 className="text-sm font-medium mb-3">Game Controls</h3>
            
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onEndGame}
              >
                End Game
              </Button>
              
              {onForceClose && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={onForceClose}
                >
                  Force Close &amp; Next Game
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={openClaimSheet}
              >
                View Claims
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
