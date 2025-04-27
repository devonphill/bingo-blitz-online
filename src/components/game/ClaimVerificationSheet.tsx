
import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import CallerTicketDisplay from './CallerTicketDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BingoWinProgress from './BingoWinProgress';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import PrizeSharingDialog from './PrizeSharingDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from '@/contexts/SessionProvider';

interface ClaimVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  tickets: Array<{
    serial: string;
    numbers: number[];
    layoutMask?: number;
  }>;
  calledNumbers: number[];
  currentNumber: number | null;
  onValidClaim: () => void;
  onFalseClaim: () => void;
  currentWinPattern?: string | null;
  gameType?: string;
  onNext?: () => void;
}

export default function ClaimVerificationSheet({
  isOpen,
  onClose,
  playerName,
  tickets,
  calledNumbers,
  currentNumber,
  onValidClaim,
  onFalseClaim,
  currentWinPattern,
  gameType = '90-ball',
  onNext
}: ClaimVerificationSheetProps) {
  const { toast } = useToast();
  const { currentSession } = useSessionContext();
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  const [validTickets, setValidTickets] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSharingDialog, setShowSharingDialog] = useState(false);
  const [validClaimsCount, setValidClaimsCount] = useState(0);
  const [isFullHouse, setIsFullHouse] = useState(false);

  console.log("ClaimVerificationSheet rendered with isOpen:", isOpen, "playerName:", playerName);

  useEffect(() => {
    console.log("ClaimVerificationSheet isOpen changed to:", isOpen);
    
    if (isOpen) {
      console.log("SHEET IS OPEN NOW with player:", playerName);
      console.log("Ticket data:", tickets);
      console.log("Current win pattern:", currentWinPattern);
      
      // Determine if this is a full house win pattern
      setIsFullHouse(currentWinPattern === 'fullHouse');
    }
    
    if (!isOpen) {
      setIsProcessing(false);
    }
  }, [isOpen, playerName, tickets, currentWinPattern]);

  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    
    console.log("Validating claim against pattern:", currentWinPattern);
    
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => calledNumbers.includes(num));
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched: Math.round((matchedNumbers.length / ticket.numbers.length) * 100),
      };
    });
    
    const sortedTickets = [...ticketsWithScore].sort((a, b) => b.score - a.score);
    setRankedTickets(sortedTickets);
    
    const gameRules = getGameRulesForType(gameType);
    let valid = false;
    const validTicketsFound: any[] = [];
    
    if (currentWinPattern) {
      sortedTickets.forEach(ticket => {
        const status = gameRules.getTicketStatus(ticket, calledNumbers, currentWinPattern);
        const isValid = status.isWinner;
        
        if (isValid) {
          valid = true;
          validTicketsFound.push({...ticket, validPattern: currentWinPattern});
        }
      });
    }
    
    console.log("Claim validity:", valid, "for pattern:", currentWinPattern);
    setIsClaimValid(valid);
    setValidTickets(validTicketsFound);
    
    if (validTicketsFound.length > 0) {
      setRankedTickets([...validTicketsFound, ...sortedTickets.filter(
        ticket => !validTicketsFound.some(vt => vt.serial === ticket.serial)
      )]);
    }
  }, [tickets, calledNumbers, currentWinPattern, gameType]);

  const handleValidClaim = async () => {
    if (isProcessing) return;
    
    if (validTickets.length > 1) {
      setValidClaimsCount(validTickets.length);
      setShowSharingDialog(true);
    } else {
      setActionType('valid');
      setIsProcessing(true);
      await handlePrizeSharing(false);
      onValidClaim();
      
      // If this is fullHouse, progress to next game
      if (isFullHouse && onNext) {
        console.log("Full house validated, will progress to next game");
        setTimeout(() => {
          onNext();
        }, 1500);
      }
    }
  };

  const handleFalseClaim = () => {
    if (isProcessing) return;
    console.log("False claim button clicked");
    setActionType('false');
    setConfirmDialogOpen(true);
  };

  const handlePrizeSharing = async (isShared: boolean) => {
    if (!currentSession?.id || !validTickets.length) return;
    
    try {
      const promises = validTickets.map(async (ticket) => {
        const gameLog = {
          session_id: currentSession.id,
          game_number: currentSession.current_game_state?.gameNumber || 1,
          game_type: `MAINSTAGE_${gameType}`,
          win_pattern: currentWinPattern || 'fullHouse',
          player_id: ticket.playerId,
          player_name: playerName,
          ticket_serial: ticket.serial,
          ticket_perm: ticket.perm,
          ticket_layout_mask: ticket.layoutMask,
          ticket_numbers: ticket.numbers,
          ticket_position: ticket.position,
          called_numbers: calledNumbers,
          total_calls: calledNumbers.length,
          last_called_number: currentNumber,
          prize_shared: isShared,
          shared_with: isShared ? validTickets.length : 1
        };

        await supabase.from('universal_game_logs').insert([gameLog]);
      });

      await Promise.all(promises);
      
      // Check if this is a full house win pattern, and if so, trigger the game progression
      if (isFullHouse && onNext) {
        console.log("Full house win validated, will progress to next game");
      }

      onClose();
    } catch (error) {
      console.error('Error saving game logs:', error);
      toast({
        title: "Error",
        description: "Failed to save game logs",
        variant: "destructive"
      });
    }
  };

  const confirmAction = () => {
    if (isProcessing) return;
    
    console.log("Confirming action:", actionType);
    setConfirmDialogOpen(false);
    setIsProcessing(true);
    
    if (actionType === 'valid') {
      onValidClaim();
      
      // If this is a full house win pattern, trigger the game progression
      if (isFullHouse && onNext) {
        console.log("Full house validated in confirmAction, will progress to next game");
        setTimeout(() => {
          onNext();
        }, 1500);
      }
    } else if (actionType === 'false') {
      onFalseClaim();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        console.log("Sheet onOpenChange called with:", open);
        if (!open && !isProcessing) onClose();
      }}>
        <SheetContent className="w-[85%] sm:w-[600px] md:w-[85%] max-w-3xl overflow-auto" side="right">
          <SheetHeader>
            <SheetTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
              {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
            </SheetTitle>
            <div className="text-sm text-gray-500">
              Current win pattern: <span className="font-semibold">{currentWinPattern || 'Full House'}</span>
              {isFullHouse && (
                <span className="ml-2 text-blue-600">(Full House - will advance game)</span>
              )}
            </div>
            {validTickets.length > 0 && (
              <div className="text-sm text-green-600 font-medium mt-1">
                Found {validTickets.length} valid winning ticket{validTickets.length > 1 ? 's' : ''}
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="mt-4 h-[calc(80vh-120px)]">
            <div className="space-y-4 pr-4">
              {rankedTickets.map((ticket) => (
                <div 
                  key={ticket.serial} 
                  className={`p-2 border rounded-md ${validTickets.some(vt => vt.serial === ticket.serial) ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Ticket: {ticket.serial}</span>
                    <span className={`font-bold ${validTickets.some(vt => vt.serial === ticket.serial) ? 'text-green-600' : ''}`}>
                      Score: {ticket.score}/{ticket.numbers.length} numbers ({ticket.percentMatched}%)
                      {validTickets.some(vt => vt.serial === ticket.serial) && ' - WINNING TICKET'}
                    </span>
                  </div>
                  <CallerTicketDisplay
                    ticket={ticket}
                    calledNumbers={calledNumbers}
                    lastCalledNumber={currentNumber}
                  />
                  {ticket.layoutMask && (
                    <div className="mt-1 text-sm">
                      Win progress: <BingoWinProgress 
                        numbers={ticket.numbers}
                        layoutMask={ticket.layoutMask}
                        calledNumbers={calledNumbers}
                        activeWinPatterns={currentWinPattern ? [currentWinPattern] : ["fullHouse"]}
                        currentWinPattern={currentWinPattern}
                        gameType={gameType}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 mt-6 sticky bottom-0 bg-white pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleFalseClaim}
              className="flex items-center gap-2"
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
              {isProcessing && actionType === 'false' ? 'Processing...' : 'False Call'}
            </Button>
            <Button
              onClick={handleValidClaim}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
            >
              <Check className="h-4 w-4" />
              {isProcessing && actionType === 'valid' ? 'Processing...' : 'Valid Claim'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'valid' ? 'Confirm Valid Claim' : 'Confirm False Call'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'valid' 
                ? `Are you sure this is a valid claim? This will ${isFullHouse ? 'complete the game and move to the next one' : 'update the game state and move to the next win pattern'}.` 
                : 'Are you sure this is a false call? This will reject the player\'s claim.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} className={actionType === 'valid' ? 'bg-green-600' : 'bg-red-600'} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : (actionType === 'valid' ? 'Confirm Valid' : 'Confirm False')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrizeSharingDialog
        isOpen={showSharingDialog}
        onClose={() => setShowSharingDialog(false)}
        onConfirm={async (isShared) => {
          setShowSharingDialog(false);
          await handlePrizeSharing(isShared);
          setActionType('valid');
          setIsProcessing(true);
          onValidClaim();
          
          // If this is a full house win pattern, trigger the game progression
          if (isFullHouse && onNext) {
            console.log("Full house win validated in sharing dialog, will progress to next game");
            setTimeout(() => {
              onNext();
            }, 1500);
          }
        }}
        playerCount={validClaimsCount}
      />
    </>
  );
}
