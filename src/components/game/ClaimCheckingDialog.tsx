
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { logWithTimestamp } from '@/utils/logUtils';
import { CheckCircle2, Clock, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  
  // Log state for debugging
  console.log('ClaimCheckingDialog props:', { isOpen, claimData });
  
  // Set up auto-close timer
  useEffect(() => {
    if (isOpen && claimData) {
      logWithTimestamp('ClaimCheckingDialog: Showing claim check details', 'info');
      console.log('ClaimCheckingDialog: Dialog opened with data', claimData);
      
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
    console.log('ClaimCheckingDialog: Not showing dialog - isOpen:', isOpen, 'claimData:', claimData ? 'present' : 'missing');
    return null;
  }

  const playerName = claimData.playerName || 'Unknown Player';
  const winPattern = claimData.winPattern || 'unknown pattern';
  const ticket = claimData.ticket;
  const calledNumbers = claimData.calledNumbers || [];
  
  console.log('ClaimCheckingDialog: Rendering dialog for', playerName, 'with ticket:', ticket?.serial);

  return isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onClose()}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 overflow-hidden animate-in fade-in zoom-in duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-amber-50 p-3 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-medium text-amber-800">Claim Being Verified</h2>
            <span className="ml-auto text-xs bg-amber-200 px-2 py-0.5 rounded-full text-amber-800">Broadcast</span>
          </div>
        </div>
        
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
          
          {/* Enhanced ticket display */}
          {ticket && (
            <Card className="w-full p-4 border bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <div className="flex items-center">
                  <Ticket className="h-4 w-4 mr-1" />
                  Ticket: {ticket.serial}
                </div>
                {ticket.numbers && (
                  <span className="text-xs bg-amber-100 px-2 py-0.5 rounded-full">
                    {ticket.numbers.filter((num: number) => calledNumbers.includes(num)).length}/{ticket.numbers.length} called
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-5 gap-2 mb-3">
                {ticket.numbers && ticket.numbers.map((num: number, index: number) => (
                  <div 
                    key={`${num}-${index}`}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-full text-base font-medium",
                      calledNumbers.includes(num) 
                        ? "bg-amber-500 text-white shadow-sm" 
                        : "bg-gray-200 text-gray-700",
                      "transition-colors duration-200"
                    )}
                  >
                    {num}
                  </div>
                ))}
              </div>
              
              <div className="text-center text-xs text-gray-600 mt-2">
                {ticket.numbers && 
                   `${ticket.numbers.filter((n: number) => calledNumbers.includes(n)).length} of ${ticket.numbers.length} numbers called`
                }
              </div>
            </Card>
          )}
          
          <div className="mt-4 p-2 bg-blue-50 border border-blue-200 rounded-md w-full text-center">
            <p className="text-sm text-blue-800">
              This broadcast was sent by the caller and is visible to all players.
            </p>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;
}
