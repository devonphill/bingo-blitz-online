import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onVerifyClaim: () => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  isClaimLightOn?: boolean;
}

export default function CallerControls({ 
  onCallNumber, 
  onVerifyClaim, 
  onEndGame,
  onGoLive,
  remainingNumbers,
  isClaimLightOn = false
}: CallerControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const { toast } = useToast();

  const handleCallNumber = () => {
    if (isClaimLightOn) {
      toast({
        title: "Claim Pending",
        description: "Please verify the current claim before calling the next number.",
        variant: "destructive"
      });
      return;
    }

    if (remainingNumbers.length === 0) {
      toast({
        title: "No more numbers",
        description: "All numbers have been called.",
        variant: "destructive"
      });
      return;
    }

    setIsCallingNumber(true);
    
    // Simulate a delay to show the number being called
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
      const number = remainingNumbers[randomIndex];
      
      onCallNumber(number);
      setIsCallingNumber(false);
    }, 1000);
  };

  const handleGoLiveClick = async () => {
    setIsGoingLive(true);
    await onGoLive();
    setIsGoingLive(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold">Caller Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-100 p-3 rounded-md text-center">
          <div className="text-sm text-gray-500 mb-1">Remaining Numbers</div>
          <div className="text-2xl font-bold">{remainingNumbers.length}</div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <Button
            className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            disabled={isCallingNumber || remainingNumbers.length === 0 || isClaimLightOn}
            onClick={handleCallNumber}
          >
            {isClaimLightOn ? 'Claim Pending' : (isCallingNumber ? 'Calling...' : 'Call Next Number')}
          </Button>
          
          <Button 
            variant="outline"
            onClick={onVerifyClaim}
          >
            Verify Claim
          </Button>
          
          <Button 
            variant="destructive"
            onClick={onEndGame}
          >
            End Game
          </Button>
          
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isGoingLive}
            onClick={handleGoLiveClick}
          >
            {isGoingLive ? 'Going Live...' : 'Go Live'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
