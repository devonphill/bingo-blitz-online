import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertOctagon } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkStatusContext';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { useToast } from '@/hooks/use-toast';

// Add this function toward the top of the file - right after imports
const GAME_UPDATES_CHANNEL = 'game-updates';
const NUMBER_CALLED_EVENT = 'number-called';

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
  disableCallButton?: boolean;
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
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [currCalledNumber, setCurrCalledNumber] = useState<number | null>(null);
  const { toast } = useToast();
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  
  // Get the network context to help with calling numbers
  const network = useNetwork();
  
  const handleCallNumber = async (number: number) => {
    if (remainingNumbers.length === 0) {
      toast({
        title: "Game Over",
        description: "All numbers have been called!",
        variant: "destructive",
      });
      return;
    }

    if (!remainingNumbers.includes(number)) {
      toast({
        title: "Already Called",
        description: `Number ${number} has already been called!`,
        variant: "destructive",
      });
      return;
    }

    if (claimCount > 0) {
      toast({
        title: "Claims Pending",
        description: "Please review pending claims before calling more numbers",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update UI state immediately
      setIsCallingNumber(true);
      setCurrCalledNumber(number);

      // Log the action
      logWithTimestamp(`Calling number: ${number} for session: ${sessionId}`, 'info');
      
      // First update the database - use correct approach for array append
      const { data: currentProgressData, error: fetchError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (fetchError) {
        throw new Error(`Database fetch error: ${fetchError.message}`);
      }
      
      // Create an updated array with the new number
      const updatedCalledNumbers = Array.isArray(currentProgressData?.called_numbers) 
        ? [...currentProgressData.called_numbers, number] 
        : [number];
        
      // Now update with the new array
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: updatedCalledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Then broadcast the new number to all players
      try {
        // Create a broadcast channel with the standardized name
        const broadcastChannel = supabase.channel(GAME_UPDATES_CHANNEL, {
          config: {
            broadcast: { self: true, ack: true }
          }
        });

        // Generate a unique ID for this broadcast
        const broadcastId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Create the payload with all necessary information
        const payload = {
          number,
          sessionId,
          calledNumbers: updatedCalledNumbers, // Include the full array of called numbers
          timestamp: Date.now(),
          broadcastId
        };
        
        // Send the broadcast event
        await broadcastChannel.send({
          type: 'broadcast',
          event: NUMBER_CALLED_EVENT,
          payload
        });
        
        logWithTimestamp(`Number ${number} broadcast sent successfully`, 'info');
      } catch (broadcastError) {
        logWithTimestamp(`Error broadcasting number ${number}: ${broadcastError}`, 'error');
        // This is non-fatal since we already updated the database
      }

      // Call the parent onCallNumber function
      onCallNumber(number);

      // Success toast
      toast({
        title: `Called: ${number}`,
        description: `Number ${number} has been called`,
        variant: "default",
      });

    } catch (error) {
      console.error('Error calling number:', error);
      toast({
        title: "Error Calling Number",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsCallingNumber(false);
    }
  };
  
  // Determine if the button should be disabled
  const isCallButtonDisabled = isLoading || 
                              remainingNumbers.length === 0 ||
                              disableCallButton || 
                              sessionStatus !== 'active';

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center justify-between">
            <div className="flex items-center">
              <span>Caller Controls</span>
            </div>
            {claimCount > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="relative"
                onClick={openClaimSheet}
              >
                <AlertOctagon className="h-4 w-4 text-amber-500" />
              </Button>
            )}
            {claimCount === 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="relative"
                onClick={openClaimSheet}
              >
                <AlertOctagon className="h-4 w-4 text-gray-500" />
              </Button>
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
              disabled={isCallButtonDisabled}
              onClick={() => {
                if (remainingNumbers.length > 0) {
                  const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
                  const number = remainingNumbers[randomIndex];
                  handleCallNumber(number);
                }
              }}
            >
              {disableCallButton && claimCount > 0 ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Review Claims First
                </>
              ) : (isLoading ? 'Calling...' : 'Call Next Number')}
            </Button>
            
            {disableCallButton && claimCount > 0 && (
              <p className="text-xs text-red-600 text-center">
                You must verify all pending claims before calling more numbers
              </p>
            )}
            
            {/*{onCloseGame && (
              <Button
                variant="secondary"
                onClick={handleCloseGame}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastGame ? 'Complete Session' : 'Close Game'}
              </Button>
            )}
            
            {/* Add FORCE close button */}
            {/*{onForceClose && (
              <Button
                variant="outline"
                onClick={handleForceClose}
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                {isLastGame ? 'FORCE Complete Session' : 'FORCE Close Game'}
              </Button>
            )}
            
            <Button 
              variant="destructive"
              onClick={onEndGame}
            >
              End Game
            </Button>
            
            <GoLiveButton
              sessionId={sessionId}
              disabled={false}
              className="w-full"
              onSuccess={() => {
                handleGoLiveClick();
              }}
            >
              Go Live
            </GoLiveButton>*/}
          </div>
          
          {/*{renderConnectionStatus()}*/}
        </CardContent>
      </Card>

      {/*<AlertDialog 
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
      
      {/* Force Close Confirmation Dialog */}
      {/*<AlertDialog 
        open={isForceCloseConfirmOpen} 
        onOpenChange={setIsForceCloseConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {isLastGame ? 'FORCE Complete Session?' : 'FORCE Close Game?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLastGame 
                ? 'This will FORCE complete the session, resetting all game data. This action cannot be undone and may disrupt active players.' 
                : 'This will FORCE close the current game, reset all numbers, and advance to the next one. This action cannot be undone and may disrupt active players.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmForceClose}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLastGame ? 'FORCE Complete' : 'FORCE Close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>*/}
    </>
  );
}
