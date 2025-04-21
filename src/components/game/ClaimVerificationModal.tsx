import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CallerTicketDisplay from './CallerTicketDisplay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BingoWinProgress from './BingoWinProgress';

interface ClaimVerificationModalProps {
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
}

export default function ClaimVerificationModal({
  isOpen,
  onClose,
  playerName,
  tickets,
  calledNumbers,
  currentNumber,
  onValidClaim,
  onFalseClaim,
  currentWinPattern
}: ClaimVerificationModalProps) {
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  
  console.log("ClaimVerificationModal rendered with isOpen:", isOpen, "playerName:", playerName, "currentWinPattern:", currentWinPattern);
  
  // Debug use useEffect to log when isOpen changes
  useEffect(() => {
    console.log("ClaimVerificationModal isOpen changed to:", isOpen);
    
    if (isOpen) {
      console.log("MODAL IS OPEN NOW with player:", playerName);
      console.log("Ticket data:", tickets);
      console.log("Current win pattern:", currentWinPattern);
    }
  }, [isOpen, playerName, tickets, currentWinPattern]);
  
  // Recalculate claim validity and rank tickets when props change
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    
    console.log("Calculating ticket scores with called numbers:", calledNumbers.length);
    
    // Calculate score for each ticket (number of matched called numbers)
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => calledNumbers.includes(num));
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched: Math.round((matchedNumbers.length / ticket.numbers.length) * 100),
        // Consistently use layoutMask
        layoutMask: ticket.layout_mask || ticket.layoutMask
      };
    });
    
    // Sort tickets by score (highest first)
    const sortedTickets = [...ticketsWithScore].sort((a, b) => b.score - a.score);
    setRankedTickets(sortedTickets);
    
    // Check claim validity based on the current win pattern
    let valid = false;
    
    // Convert each ticket to check against the current win pattern
    if (currentWinPattern === "oneLine") {
      // For one line, we need to check if any row is complete
      valid = sortedTickets.some(ticket => {
        // Use layoutMask consistently
        const layoutMask = ticket.layoutMask || 0;
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        // Reconstruct the ticket rows
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        // Check if any row is complete
        return rows.some(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        );
      });
    } else if (currentWinPattern === "twoLines") {
      // For two lines, we need to check if any two rows are complete
      valid = sortedTickets.some(ticket => {
        // Use layoutMask consistently
        const layoutMask = ticket.layoutMask || 0;
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        // Reconstruct the ticket rows
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        // Count complete rows
        const completeRows = rows.filter(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        ).length;
        
        return completeRows >= 2;
      });
    } else {
      // For full house or default, check if all numbers in any ticket have been called
      valid = sortedTickets.some(ticket => 
        ticket.numbers.every(number => calledNumbers.includes(number))
      );
    }
    
    console.log("Claim validity for pattern", currentWinPattern, ":", valid);
    setIsClaimValid(valid);
  }, [tickets, calledNumbers, currentWinPattern]);

  const handleValidClaim = () => {
    console.log("Valid claim button clicked");
    setActionType('valid');
    setConfirmDialogOpen(true);
  };

  const handleFalseClaim = () => {
    console.log("False claim button clicked");
    setActionType('false');
    setConfirmDialogOpen(true);
  };

  const confirmAction = () => {
    console.log("Confirming action:", actionType);
    setConfirmDialogOpen(false);
    if (actionType === 'valid') {
      onValidClaim();
    } else if (actionType === 'false') {
      onFalseClaim();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        console.log("Dialog onOpenChange called with:", open);
        if (!open) onClose();
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
              {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
            </DialogTitle>
            <div className="text-sm text-gray-500">
              Current win pattern: <span className="font-semibold">{currentWinPattern || 'Full House'}</span>
            </div>
          </DialogHeader>

          <ScrollArea className="mt-4 h-[50vh]">
            <div className="space-y-4">
              {rankedTickets.map((ticket) => (
                <div key={ticket.serial} className="p-2 border rounded-md">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Ticket: {ticket.serial}</span>
                    <span className="font-bold">
                      Score: {ticket.score}/{ticket.numbers.length} numbers ({ticket.percentMatched}%)
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
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="destructive"
              onClick={handleFalseClaim}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              False Call
            </Button>
            <Button
              onClick={handleValidClaim}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Valid Claim
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'valid' ? 'Confirm Valid Claim' : 'Confirm False Call'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'valid' 
                ? 'Are you sure this is a valid claim? This will update the game state and may affect prizes.' 
                : 'Are you sure this is a false call? This will reject the player\'s claim.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} className={actionType === 'valid' ? 'bg-green-600' : 'bg-red-600'}>
              {actionType === 'valid' ? 'Confirm Valid' : 'Confirm False'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
