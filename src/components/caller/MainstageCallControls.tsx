
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface MainstageCallControlsProps {
  onCallNumber: () => void;
  lastCalledNumber: number | null;
  totalCalls: number;
  pendingClaims: number;
  onViewClaims: () => void;
  sessionStatus?: string;
  onCloseGame?: () => void;
  currentGameNumber?: number;
  numberOfGames?: number;
}

export function MainstageCallControls({
  onCallNumber,
  lastCalledNumber,
  totalCalls,
  pendingClaims,
  onViewClaims,
  sessionStatus = 'pending',
  onCloseGame,
  currentGameNumber = 1,
  numberOfGames = 1
}: MainstageCallControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isClosingConfirmOpen, setIsClosingConfirmOpen] = useState(false);
  const { toast } = useToast();
  const isLastGame = currentGameNumber >= numberOfGames;

  const handleBellClick = () => {
    onViewClaims();
  };

  const handleCloseGame = () => {
    setIsClosingConfirmOpen(true);
  };

  const confirmCloseGame = () => {
    if (onCloseGame) {
      onCloseGame();
    }
    setIsClosingConfirmOpen(false);
  };

  console.log("MainstageCallControls props:", { 
    currentGameNumber, 
    numberOfGames, 
    isLastGame, 
    sessionStatus
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              <span>Caller Controls</span>
              <Badge className="ml-2" variant={sessionStatus === 'active' ? 'default' : 'outline'}>
                {sessionStatus === 'active' ? 'Live' : 'Pending'}
              </Badge>
              <Badge className="ml-2" variant="outline">
                Game {currentGameNumber} of {numberOfGames}
              </Badge>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="relative"
              onClick={handleBellClick}
            >
              <Bell className={pendingClaims > 0 ? "text-amber-500" : "text-gray-500"} />
              {pendingClaims > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500">
                  {pendingClaims}
                </Badge>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 p-3 rounded-md text-center">
            <div className="text-sm text-gray-500 mb-1">Called Numbers</div>
            <div className="text-2xl font-bold">{totalCalls}</div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <Button
              className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
              disabled={isCallingNumber || sessionStatus !== 'active'}
              onClick={() => {
                setIsCallingNumber(true);
                onCallNumber();
                setTimeout(() => setIsCallingNumber(false), 1000);
              }}
            >
              {isCallingNumber ? 'Calling...' : 'Call Next Number'}
            </Button>
            
            {onCloseGame && (
              <Button
                variant="secondary"
                onClick={handleCloseGame}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastGame ? 'Complete Session' : 'Close Game'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog 
        open={isClosingConfirmOpen} 
        onOpenChange={setIsClosingConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLastGame ? 'Complete Session?' : 'Close Game?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLastGame 
                ? 'This will mark the session as completed. This action cannot be undone.' 
                : 'This will close the current game and advance to the next one. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCloseGame}
              className={isLastGame ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isLastGame ? 'Complete Session' : 'Close Game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
