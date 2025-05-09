
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

interface ClaimResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: 'valid' | 'invalid' | null;
  playerName: string;
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
  ticket
}: ClaimResultDialogProps) {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Set up auto-close timer
  useEffect(() => {
    if (isOpen && result) {
      logWithTimestamp(`ClaimResultDialog: Showing ${result} result for ${playerName}`);
      
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        logWithTimestamp('ClaimResultDialog: Auto-closing after timeout');
        onClose();
      }, 5000);
      
      setAutoCloseTimer(timer);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [isOpen, result, onClose, playerName]);
  
  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
    };
  }, [autoCloseTimer]);

  if (!isOpen || !result) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {result === 'valid' ? 'Bingo Claim Validated!' : 'Bingo Claim Invalid'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center p-4">
          {/* Large icon showing result */}
          <div className="mb-4">
            {result === 'valid' ? (
              <CheckCircle2 className="h-20 w-20 text-green-500" />
            ) : (
              <XCircle className="h-20 w-20 text-red-500" />
            )}
          </div>
          
          <p className="text-lg font-medium mb-4">
            {result === 'valid'
              ? `${playerName}'s claim was verified!`
              : `${playerName}'s claim was rejected.`}
          </p>
          
          {/* Show ticket if available */}
          {ticket && (
            <Card className="w-full p-2 border bg-gray-50">
              <div className="text-sm text-gray-500 mb-2">Ticket: {ticket.serial}</div>
              <div className="grid grid-cols-5 gap-1">
                {ticket.numbers.map((num, index) => (
                  <div 
                    key={`${num}-${index}`}
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-full text-sm 
                      ${ticket.calledNumbers.includes(num) 
                        ? "bg-green-500 text-white" 
                        : "bg-gray-200 text-gray-700"}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
