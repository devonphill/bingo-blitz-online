
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ClaimResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: 'valid' | 'invalid' | null;
  playerName: string;
  isGlobalBroadcast?: boolean;
  ticket?: {
    serial: string;
    numbers: number[];
    calledNumbers: number[];
  };
}

export default function ClaimResultDialog({
  isOpen,
  onClose,
  result,
  playerName,
  isGlobalBroadcast = false,
  ticket
}: ClaimResultDialogProps) {
  const isValid = result === 'valid';
  
  // Custom dialog styling based on result
  const dialogStyles = isValid
    ? "border-green-200 shadow-green-100"
    : "border-red-200 shadow-red-100";
    
  const titleStyles = isValid
    ? "text-green-700"
    : "text-red-700";
    
  const iconStyles = isValid
    ? "text-green-600"
    : "text-red-600";
    
  const Icon = isValid ? CheckCircle2 : XCircle;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`w-[95vw] max-w-md rounded-lg border-2 ${dialogStyles}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center justify-center text-xl gap-2 ${titleStyles}`}>
            <Icon className="h-5 w-5" />
            <span>
              {isValid 
                ? isGlobalBroadcast ? "Bingo Winner!" : "Bingo Verified!"
                : "Bingo Check Failed"}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center p-4 gap-4">
          <div className={`w-16 h-16 rounded-full ${isValid ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
            <Icon className={`h-8 w-8 ${iconStyles}`} />
          </div>
          
          <h3 className="text-lg font-semibold text-center">
            {isGlobalBroadcast 
              ? `${playerName} has won Bingo!`
              : isValid
                ? "Your Bingo claim has been verified!"
                : "Your Bingo claim was rejected"}
          </h3>
          
          {ticket && (
            <div className="mt-2 text-sm text-gray-500">
              <p>Ticket: {ticket.serial}</p>
              <p>Matched: {ticket.numbers.filter(n => ticket.calledNumbers.includes(n)).length} numbers</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            onClick={onClose}
            className={isValid ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"}
          >
            {isValid ? "Great!" : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
