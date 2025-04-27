
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSessionProgress } from '@/hooks/useSessionProgress';

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
  const { progress } = useSessionProgress(currentSession?.id);

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

  // Effect to sync with session progress on load/refresh
  useEffect(() => {
    if (progress && currentSession) {
      console.log("Syncing MainstageCallControls with session progress:", progress);
      
      // If we have progress data but the UI doesn't match it, we can sync the UI
      // This is especially useful on page refresh
      if (progress.current_win_pattern && activeWinPatterns && activeWinPatterns.length > 0) {
        const progressPattern = progress.current_win_pattern;
        
        // Check if progress pattern is in the activeWinPatterns array
        const hasPattern = activeWinPatterns.includes(progressPattern);
        
        if (!hasPattern) {
          console.log(`Pattern mismatch detected - DB: ${progressPattern}, UI patterns: ${activeWinPatterns.join(', ')}`);
          
          // Force refresh the page to reload the correct patterns from database
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      }
      
      if (progress.current_game_number !== currentGameNumber) {
        console.log(`Game number mismatch detected - DB: ${progress.current_game_number}, UI: ${currentGameNumber}`);
        
        // Force refresh the page to reload the correct game number from database
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    }
  }, [progress, currentSession, activeWinPatterns, currentGameNumber]);

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

  const confirmCloseGame = async () => {
    if (onCloseGame) {
      setIsProcessingClose(true);
      
      // Get next pattern and determine progression type
      let nextPattern: string | null = null;
      let progressType = "game"; // Default to game progression
      let updateSessionProgress = true;
      
      if (activeWinPatterns && activeWinPatterns.length > 0) {
        const currentPattern = activeWinPatterns[0].replace('MAINSTAGE_', '');
        console.log(`Current pattern: ${currentPattern}`);
        
        if (currentPattern === 'oneLine') {
          nextPattern = 'twoLines';
          progressType = "pattern";
        } else if (currentPattern === 'twoLines') {
          nextPattern = 'fullHouse';
          progressType = "pattern";
        } else if (currentPattern === 'fullHouse' && !isLastGame) {
          progressType = "game";
          nextPattern = 'oneLine'; // Reset to oneLine for next game
        } else if (isLastGame) {
          // Last game and last pattern - session complete
          progressType = "complete";
          updateSessionProgress = false;
        }
      }
      
      console.log(`Progression type: ${progressType}, Next pattern: ${nextPattern}, Update progress: ${updateSessionProgress}`);
      
      // Update session progress in the database directly
      if (currentSession?.id && updateSessionProgress) {
        try {
          console.log("Updating session progress for pattern/game change");
          let updateData: any = {};
          
          if (progressType === "pattern" && nextPattern) {
            updateData = {
              current_win_pattern: nextPattern
            };
            console.log(`Updating win pattern to: ${nextPattern}`);
          } else if (progressType === "game" && !isLastGame) {
            updateData = {
              current_game_number: currentGameNumber + 1,
              current_win_pattern: 'oneLine' // Reset to oneLine for new game
            };
            console.log(`Updating game number to: ${currentGameNumber + 1}`);
          }
          
          // Only update if we have data to update
          if (Object.keys(updateData).length > 0) {
            const { data, error } = await supabase
              .from('sessions_progress')
              .update(updateData)
              .eq('session_id', currentSession.id)
              .select();
              
            if (error) {
              console.error('Error updating session progress:', error);
              toast({
                title: "Error",
                description: "Failed to update session progress. Please try again.",
                variant: "destructive"
              });
            } else {
              console.log('Session progress updated successfully:', data);
            }
          }
        } catch (err) {
          console.error('Error in updateProgress:', err);
          toast({
            title: "Error",
            description: "An unexpected error occurred while updating the game.",
            variant: "destructive"
          });
        }
      }
      
      // Call the onCloseGame function after updating progress
      try {
        await onCloseGame();
      } catch (error) {
        console.error("Error in onCloseGame:", error);
        toast({
          title: "Error",
          description: "Failed to close the game. Please try again.",
          variant: "destructive"
        });
      }
      
      // Let UI update before resetting the states
      setTimeout(() => {
        setIsProcessingClose(false);
        setIsClosingConfirmOpen(false);
        
        // Broadcast win pattern change to all players
        if (currentSession?.id) {
          console.log("Broadcasting pattern/game change");
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
                patternProgression: progressType === "pattern",
                gameProgression: progressType === "game",
                progressType: progressType,
                timestamp: new Date().toISOString()
              }
            }).then(() => {
              console.log("Game progression broadcast sent with details:", {
                previousGame: currentGameNumber,
                newGame: isLastGame ? currentGameNumber : currentGameNumber + 1,
                nextPattern,
                progressType
              });
            }).catch(err => {
              console.error("Error broadcasting game progression:", err);
            });
        }
      }, 500);
      
      // Show toast about progression
      const displayMessage = progressType === "complete" ? 
        "The session has been completed successfully." : 
        progressType === "pattern" && nextPattern ? 
          `Advanced to ${getPatternDisplayName(nextPattern)} pattern` :
          progressType === "game" ? 
            `Advanced to game ${currentGameNumber + 1}` :
            "Game updated";
            
      toast({
        title: progressType === "complete" ? "Session Completed" : "Game Advanced",
        description: displayMessage,
      });
    }
  };

  console.log("MainstageCallControls props:", { 
    currentGameNumber, 
    numberOfGames, 
    isLastGame, 
    sessionStatus,
    activeWinPatterns,
    sessionProgress: progress ? 
      `Game ${progress.current_game_number}/${progress.max_game_number}, Pattern: ${progress.current_win_pattern}` : 
      'Not loaded'
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
                {getPatternDisplayName(activeWinPatterns[0].replace('MAINSTAGE_', ''))}
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
