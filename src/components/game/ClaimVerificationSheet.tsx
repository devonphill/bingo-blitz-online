
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
  currentWinPattern
}: ClaimVerificationSheetProps) {
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  const [validTickets, setValidTickets] = useState<any[]>([]);
  
  console.log("ClaimVerificationSheet rendered with isOpen:", isOpen, "playerName:", playerName);
  
  useEffect(() => {
    console.log("ClaimVerificationSheet isOpen changed to:", isOpen);
    
    if (isOpen) {
      console.log("SHEET IS OPEN NOW with player:", playerName);
      console.log("Ticket data:", tickets);
      console.log("Current win pattern:", currentWinPattern);
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
    
    let valid = false;
    const validTicketsFound: any[] = [];
    
    // Validate based on current win pattern
    if (currentWinPattern === "oneLine") {
      sortedTickets.forEach(ticket => {
        const layoutMask = ticket.layoutMask;
        if (!layoutMask) return;
        
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        const isValid = rows.some(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        );
        
        if (isValid) {
          valid = true;
          validTicketsFound.push({...ticket, validPattern: 'oneLine'});
        }
      });
    } else if (currentWinPattern === "twoLines") {
      sortedTickets.forEach(ticket => {
        const layoutMask = ticket.layoutMask;
        if (!layoutMask) return;
        
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const rows: number[][] = [[], [], []];
        let numIndex = 0;
        
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            rows[row].push(ticket.numbers[numIndex]);
            numIndex++;
          }
        }
        
        const completeRows = rows.filter(row => 
          row.length > 0 && row.every(num => calledNumbers.includes(num))
        ).length;
        
        if (completeRows >= 2) {
          valid = true;
          validTicketsFound.push({...ticket, validPattern: 'twoLines'});
        }
      });
    } else if (currentWinPattern === "fullHouse") {
      sortedTickets.forEach(ticket => {
        const isValid = ticket.numbers.every(number => calledNumbers.includes(number));
        if (isValid) {
          valid = true;
          validTicketsFound.push({...ticket, validPattern: 'fullHouse'});
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
      onClose(); // Close sheet after handling the claim
    } else if (actionType === 'false') {
      onFalseClaim();
      onClose(); // Close sheet after handling the claim
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        console.log("Sheet onOpenChange called with:", open);
        if (!open) onClose();
      }}>
        <SheetContent className="w-[85%] sm:w-[600px] md:w-[85%] max-w-3xl overflow-auto" side="right">
          <SheetHeader>
            <SheetTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
              {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
            </SheetTitle>
            <div className="text-sm text-gray-500">
              Current win pattern: <span className="font-semibold">{currentWinPattern || 'Full House'}</span>
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
