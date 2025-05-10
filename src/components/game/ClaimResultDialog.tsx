
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Award } from 'lucide-react';
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
  isGlobalBroadcast?: boolean;
}

export default function ClaimResultDialog({
  isOpen,
  onClose,
  result,
  playerName,
  ticket,
  isGlobalBroadcast = false
}: ClaimResultDialogProps) {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Set up auto-close timer
  useEffect(() => {
    if (isOpen && result) {
      logWithTimestamp(`ClaimResultDialog: Showing ${result} result for ${playerName} (global: ${isGlobalBroadcast})`);
      
      // Also show a toast for quick notification
      toast({
        title: isGlobalBroadcast ? `${result === 'valid' ? 'Bingo Verified!' : 'Claim Rejected'}` : 
                                   `${result === 'valid' ? 'Your Bingo Verified!' : 'Your Claim Rejected'}`,
        description: isGlobalBroadcast ? 
                     `${playerName}'s claim was ${result === 'valid' ? 'validated' : 'rejected'}` :
                     `Your claim was ${result === 'valid' ? 'validated' : 'rejected'}`,
        variant: result === 'valid' ? 'default' : 'destructive',
        duration: 5000
      });
      
      // Auto close after longer time for global broadcasts, shorter for own claims
      const closeDelay = isGlobalBroadcast ? 8000 : 5000;
      const timer = setTimeout(() => {
        logWithTimestamp('ClaimResultDialog: Auto-closing after timeout');
        onClose();
      }, closeDelay);
      
      setAutoCloseTimer(timer);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [isOpen, result, onClose, playerName, toast, isGlobalBroadcast]);
  
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
          <DialogTitle className={isGlobalBroadcast ? "flex items-center gap-2" : ""}>
            {isGlobalBroadcast && <Award className="h-5 w-5 text-amber-500" />}
            {result === 'valid' ? 'Bingo Claim Validated!' : 'Bingo Claim Invalid'}
            {isGlobalBroadcast && <span className="text-sm text-muted-foreground ml-2">Broadcast</span>}
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
            {isGlobalBroadcast 
              ? `${playerName}'s claim was ${result === 'valid' ? 'verified!' : 'rejected.'}`
              : `Your claim was ${result === 'valid' ? 'verified!' : 'rejected.'}`}
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
          
          {/* Additional information for global broadcasts */}
          {isGlobalBroadcast && (
            <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded-md w-full text-center">
              <p className="text-sm text-amber-800">
                This claim was broadcast by the caller and visible to all players.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
