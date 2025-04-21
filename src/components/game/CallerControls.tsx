import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface CallerControlsProps {
  onCallNumber: (number: number) => void;
  onEndGame: () => void;
  onGoLive: () => Promise<void>;
  remainingNumbers: number[];
  sessionId: string;
  winPatterns: string[];
  onCheckClaims?: () => void;
  claimCount?: number;
}

export default function CallerControls({ 
  onCallNumber, 
  onEndGame,
  onGoLive,
  remainingNumbers,
  sessionId,
  winPatterns,
  onCheckClaims,
  claimCount = 0
}: CallerControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [pendingClaims, setPendingClaims] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    setPendingClaims(claimCount);
  }, [claimCount]);

  useEffect(() => {
    if (!sessionId) return;

    const checkPendingClaims = async () => {
      try {
        const { data, error } = await supabase
          .from('bingo_claims')
          .select('id')
          .eq('session_id', sessionId)
          .eq('status', 'pending');
          
        if (!error && data) {
          setPendingClaims(data.length);
        }
      } catch (err) {
        console.error("Error checking pending claims:", err);
      }
    };
    
    checkPendingClaims();
    
    const claimsChannel = supabase
      .channel('caller-claims-counter')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bingo_claims',
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          checkPendingClaims();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(claimsChannel);
    };
  }, [sessionId]);

  const handleCallNumber = () => {
    if (remainingNumbers.length === 0) {
      toast({
        title: "No more numbers",
        description: "All numbers have been called.",
        variant: "destructive"
      });
      return;
    }

    setIsCallingNumber(true);
    
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
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId);

      if (sessionError) {
        throw sessionError;
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

  const handleCheckClaimsClick = () => {
    if (onCheckClaims) {
      onCheckClaims();
      toast({
        title: "Checking Claims",
        description: "Manually checking for player claims...",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <span>Caller Controls</span>
          {pendingClaims > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="relative">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                    {pendingClaims}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Pending Claims</h4>
                  <p className="text-sm">
                    There {pendingClaims === 1 ? 'is' : 'are'} {pendingClaims} pending 
                    claim{pendingClaims === 1 ? '' : 's'} awaiting verification.
                  </p>
                  <Button size="sm" onClick={handleCheckClaimsClick} className="w-full">
                    Check Claims
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-100 p-3 rounded-md text-center">
          <div className="text-sm text-gray-500 mb-1">Remaining Numbers</div>
          <div className="text-2xl font-bold">{remainingNumbers.length}</div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <Button
            className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
            disabled={isCallingNumber || remainingNumbers.length === 0}
            onClick={handleCallNumber}
          >
            {isCallingNumber ? 'Calling...' : 'Call Next Number'}
          </Button>
          
          {pendingClaims > 0 && (
            <Button 
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              onClick={handleCheckClaimsClick}
            >
              <Bell className="h-4 w-4 mr-2" />
              Check Claims ({pendingClaims})
            </Button>
          )}
          
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
