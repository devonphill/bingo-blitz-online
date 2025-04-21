
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onVerifyClaim: () => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  isClaimLightOn?: boolean;
  sessionId: string;
  winPatterns: string[];
}

export default function CallerControls({ 
  onCallNumber, 
  onVerifyClaim, 
  onEndGame,
  onGoLive,
  remainingNumbers,
  isClaimLightOn = false,
  sessionId,
  winPatterns
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
    if (winPatterns.length === 0) {
      toast({
        title: "Error",
        description: "At least one win pattern must be selected before going live",
        variant: "destructive"
      });
      return;
    }

    setIsGoingLive(true);
    try {
      // Update session status
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId);

      if (sessionError) {
        throw sessionError;
      }

      // Update win patterns to persist them
      const { error: patternsError } = await supabase
        .from('win_patterns')
        .upsert({
          session_id: sessionId,
          one_line_active: winPatterns.includes('oneLine'),
          two_lines_active: winPatterns.includes('twoLines'),
          full_house_active: winPatterns.includes('fullHouse')
        }, { onConflict: 'session_id' });

      if (patternsError) {
        throw patternsError;
      }

      await onGoLive();
      
      toast({
        title: "Success",
        description: "Game is now live!",
      });
    } catch (error) {
      console.error('Error going live:', error);
      toast({
        title: "Error",
        description: "Failed to start the game. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGoingLive(false);
    }
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
            disabled={isGoingLive || winPatterns.length === 0}
            onClick={handleGoLiveClick}
          >
            {isGoingLive ? 'Going Live...' : 'Go Live'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
