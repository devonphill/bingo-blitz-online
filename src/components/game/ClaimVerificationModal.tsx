
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
}

export default function ClaimVerificationModal({
  isOpen,
  onClose,
  playerName,
  tickets,
  calledNumbers,
  currentNumber,
  onValidClaim,
  onFalseClaim
}: ClaimVerificationModalProps) {
  const [isClaimValid, setIsClaimValid] = useState(false);
  const [rankedTickets, setRankedTickets] = useState<any[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'valid' | 'false' | null>(null);
  
  // Recalculate claim validity and rank tickets when props change
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    
    // Calculate score for each ticket (number of matched called numbers)
    const ticketsWithScore = tickets.map(ticket => {
      const matchedNumbers = ticket.numbers.filter(num => calledNumbers.includes(num));
      return { 
        ...ticket, 
        score: matchedNumbers.length,
        percentMatched: Math.round((matchedNumbers.length / ticket.numbers.length) * 100)
      };
    });
    
    // Sort tickets by score (highest first)
    const sortedTickets = [...ticketsWithScore].sort((a, b) => b.score - a.score);
    setRankedTickets(sortedTickets);
    
    // A claim is valid if all numbers on any ticket have been called
    const valid = tickets.some(ticket => 
      ticket.numbers.every(number => calledNumbers.includes(number))
    );
    
    setIsClaimValid(valid);
  }, [tickets, calledNumbers]);

  const handleValidClaim = () => {
    setActionType('valid');
    setConfirmDialogOpen(true);
  };

  const handleFalseClaim = () => {
    setActionType('false');
    setConfirmDialogOpen(true);
  };

  const confirmAction = () => {
    setConfirmDialogOpen(false);
    if (actionType === 'valid') {
      onValidClaim();
    } else if (actionType === 'false') {
      onFalseClaim();
    }
  };

  // If the modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
              {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
            </DialogTitle>
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
