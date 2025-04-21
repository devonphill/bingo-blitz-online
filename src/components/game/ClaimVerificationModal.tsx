
import React from 'react';
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

interface ClaimVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  tickets: Array<{
    serial: string;
    numbers: number[];
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
  // Determine if claim is valid when all numbers on any ticket have been called
  const isClaimValid = tickets.some(ticket => 
    ticket.numbers.every(number => calledNumbers.includes(number))
  );

  const handleValidClaim = () => {
    onValidClaim();
    onClose();
  };

  const handleFalseClaim = () => {
    onFalseClaim();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className={`text-2xl font-bold ${isClaimValid ? 'text-green-600' : 'text-red-600'}`}>
            {isClaimValid ? 'CLAIM VALID' : 'CLAIM INVALID'} - {playerName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="mt-4 h-[50vh]">
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket.serial} className="p-2">
                <div className="text-sm text-gray-500 mb-1">Ticket: {ticket.serial}</div>
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
  );
}
