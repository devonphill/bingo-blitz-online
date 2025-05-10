
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { logWithTimestamp } from '@/utils/logUtils';
import { CheckCircle2, Clock } from 'lucide-react';

interface ClaimCheckingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimData: any;
}

export default function ClaimCheckingDialog({
  isOpen,
  onClose,
  claimData
}: ClaimCheckingDialogProps) {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Set up auto-close timer
  useEffect(() => {
    if (isOpen && claimData) {
      logWithTimestamp('ClaimCheckingDialog: Showing claim check details', 'info');
      
      // Auto close after a delay
      const timer = setTimeout(() => {
        logWithTimestamp('ClaimCheckingDialog: Auto-closing after timeout', 'info');
        onClose();
      }, 10000); // 10 second timeout
      
      setAutoCloseTimer(timer);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [isOpen, claimData, onClose]);
  
  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
    };
  }, [autoCloseTimer]);

  if (!isOpen || !claimData) {
    return null;
  }

  const playerName = claimData.playerName || 'Unknown Player';
  const winPattern = claimData.winPattern || 'unknown pattern';
  const ticket = claimData.ticket;
  const calledNumbers = claimData.calledNumbers || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Claim Being Verified
            <span className="text-sm text-muted-foreground ml-2">Broadcast</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center p-4">
          {/* Icon showing checking status */}
          <div className="mb-4 relative">
            <div className="animate-pulse">
              <CheckCircle2 className="h-14 w-14 text-amber-500" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-white"></div>
            </div>
          </div>
          
          <div className="bg-amber-50 p-3 rounded-md border border-amber-200 w-full mb-4 text-center">
            <p className="text-amber-800 font-medium">
              The caller is reviewing this claim
            </p>
          </div>
          
          <p className="text-lg font-medium mb-2 text-center">
            {playerName} has claimed {winPattern}
          </p>
          
          <p className="text-sm text-gray-500 mb-4 text-center">
            The caller will verify this claim soon
          </p>
          
          {/* Show ticket if available */}
          {ticket && (
            <Card className="w-full p-2 border bg-gray-50">
              <div className="text-sm text-gray-500 mb-2">Ticket: {ticket.serial}</div>
              <div className="grid grid-cols-5 gap-1">
                {ticket.numbers && ticket.numbers.map((num: number, index: number) => (
                  <div 
                    key={`${num}-${index}`}
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-full text-sm 
                      ${calledNumbers.includes(num) 
                        ? "bg-amber-500 text-white" 
                        : "bg-gray-200 text-gray-700"}
                    `}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded-md w-full text-center">
            <p className="text-sm text-blue-800">
              This broadcast was sent by the caller and is visible to all players.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
