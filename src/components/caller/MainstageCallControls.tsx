
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

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
  currentSession?: any;
  activeWinPatterns?: string[];
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
  numberOfGames = 1,
  currentSession,
  activeWinPatterns = []
}: MainstageCallControlsProps) {
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isClosingConfirmOpen, setIsClosingConfirmOpen] = useState(false);
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const { toast } = useToast();
  const isLastGame = currentGameNumber >= numberOfGames;

  const handleBellClick = () => {
    onViewClaims();
  };

  const handleCloseGame = () => {
    setIsClosingConfirmOpen(true);
  };

  useEffect(() => {
    if (isProcessingClose) {
      console.log("Processing game close, will proceed with confirmation soon");
    }
  }, [isProcessingClose]);

  const getPatternDisplayName = (pattern: string): string => {
    switch(pattern) {
      case 'oneLine': return 'One Line';
      case 'twoLines': return 'Two Lines';
      case 'fullHouse': return 'Full House';
      case 'pattern': return 'Pattern';
      case 'blackout': return 'Blackout';
      default: return pattern;
    }
  };

  const confirmCloseGame = () => {
    if (onCloseGame) {
      setIsProcessingClose(true);
      
      // Call the onCloseGame function with a small delay to allow dialog to close
      setTimeout(() => {
        onCloseGame();
        
        // Let UI update before resetting the states
        setTimeout(() => {
          setIsProcessingClose(false);
          setIsClosingConfirmOpen(false);
          
          // Get next pattern for display in broadcast
          let nextPattern: string | null = null;
          let progressType = "game"; // Default to game progression
          
          if (activeWinPatterns && activeWinPatterns.length > 0) {
            const currentPattern = activeWinPatterns[0];
            if (currentPattern === 'oneLine' || currentPattern === 'MAINSTAGE_oneLine') {
              nextPattern = 'twoLines';
              progressType = "pattern";
            } else if (currentPattern === 'twoLines' || currentPattern === 'MAINSTAGE_twoLines') {
              nextPattern = 'fullHouse';
              progressType = "pattern";
            }
          }
          
          // Update session progress in the database directly
          if (currentSession?.id) {
            const updateProgress = async () => {
              try {
                console.log("Updating session progress for pattern change");
                let updateData = {};
                
                if (progressType === "pattern" && nextPattern) {
                  updateData = {
                    current_win_pattern: nextPattern
                  };
                  console.log(`Updating win pattern to: ${nextPattern}`);
                } else if (!isLastGame) {
                  updateData = {
                    current_game_number: currentGameNumber + 1,
                    current_win_pattern: 'oneLine' // Reset to oneLine for new game
                  };
                  console.log(`Updating game number to: ${currentGameNumber + 1}`);
                }
                
                // Only update if we have data to update
                if (Object.keys(updateData).length > 0) {
                  const { error } = await supabase
                    .from('sessions_progress')
                    .update(updateData)
                    .eq('session_id', currentSession.id);
                    
                  if (error) {
                    console.error('Error updating session progress:', error);
                  } else {
                    console.log('Session progress updated successfully');
                  }
                }
              } catch (err) {
                console.error('Error in updateProgress:', err);
              }
            };
            
            updateProgress();
          }
          
          // Broadcast win pattern change to all players
          if (currentSession?.id) {
            console.log("Broadcasting pattern change due to game progression");
            supabase.channel('player-game-updates')
              .send({
                type: 'broadcast',
                event: 'claim-update',
                payload: {
                  sessionId: currentSession.id,
                  patternChange: true,
                  nextPattern: nextPattern,
                  timestamp: new Date().toISOString()
                }
              }).then(() => {
                console.log("Pattern change broadcast sent");
              }).catch(err => {
                console.error("Error broadcasting pattern change:", err);
              });
            
            // Also send a dedicated game progression event
            supabase.channel('game-progression-channel')
              .send({
                type: 'broadcast',
                event: 'game-progression',
                payload: {
                  sessionId: currentSession.id,
                  previousGame: currentGameNumber,
                  newGame: isLastGame ? currentGameNumber : currentGameNumber + 1,
                  previousPatterns: activeWinPatterns,
                  nextPattern: nextPattern,
                  progressType: progressType,
                  timestamp: new Date().toISOString()
                }
              }).then(() => {
                console.log("Game progression broadcast sent with details:", {
                  previousGame: currentGameNumber,
                  newGame: isLastGame ? currentGameNumber : currentGameNumber + 1,
                  nextPattern
                });
              }).catch(err => {
                console.error("Error broadcasting game progression:", err);
              });
          }
        }, 500);
      }, 300);
      
      // Show toast about progression
      const displayMessage = isLastGame ? 
        "The session has been completed successfully." : 
        nextPatternOrGameMessage(activeWinPatterns);
        
      toast({
        title: isLastGame ? "Session Completed" : "Game Advanced",
        description: displayMessage,
      });
    }
  };
  
  // Helper function to determine next pattern message
  const nextPatternOrGameMessage = (patterns: string[]) => {
    if (!patterns || patterns.length === 0) return `Advanced to game ${currentGameNumber + 1}`;
    
    const currentPattern = patterns[0];
    if (currentPattern === 'oneLine' || currentPattern === 'MAINSTAGE_oneLine') {
      return "Advanced to Two Lines pattern";
    } else if (currentPattern === 'twoLines' || currentPattern === 'MAINSTAGE_twoLines') {
      return "Advanced to Full House pattern";
    } else {
      return `Advanced to game ${currentGameNumber + 1}`;
    }
  };

  console.log("MainstageCallControls props:", { 
    currentGameNumber, 
    numberOfGames, 
    isLastGame, 
    sessionStatus,
    activeWinPatterns
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
          
          {activeWinPatterns && activeWinPatterns.length > 0 && (
            <div className="bg-gray-100 p-3 rounded-md text-center">
              <div className="text-sm text-gray-500 mb-1">Current Pattern</div>
              <div className="text-xl font-semibold">
                {getPatternDisplayName(activeWinPatterns[0])}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-3">
            <Button
              className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary"
              disabled={isCallingNumber || sessionStatus !== 'active' || isProcessingClose}
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
                disabled={isProcessingClose}
              >
                {isProcessingClose ? 'Processing...' : isLastGame ? 'Complete Session' : 'Close Game'}
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
            <AlertDialogCancel disabled={isProcessingClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCloseGame}
              className={isLastGame ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"}
              disabled={isProcessingClose}
            >
              {isProcessingClose ? 'Processing...' : isLastGame ? 'Complete Session' : 'Close Game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
