
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Check, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';

interface ClaimResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: 'valid' | 'invalid';
  playerName: string;
  isGlobalBroadcast?: boolean;
  ticket?: any;
}

export default function ClaimResultDialog({
  isOpen,
  onClose,
  result,
  playerName,
  isGlobalBroadcast = false,
  ticket
}: ClaimResultDialogProps) {
  // Auto-close after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  // Process ticket data for display if available
  const hasTicket = ticket && (
    Array.isArray(ticket.numbers) || 
    Array.isArray(ticket.calledNumbers)
  );
  
  const ticketData = hasTicket ? {
    numbers: ticket.numbers || [],
    layoutMask: ticket.layoutMask || ticket.layout_mask || 0,
    calledNumbers: ticket.calledNumbers || [],
    serial: ticket.serial || 'Unknown',
    perm: ticket.perm || 0,
    position: ticket.position || 0
  } : null;
  
  const isValid = result === 'valid';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Claim Result
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          {/* Result overlay */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center z-[100] bg-black/30 backdrop-blur-sm",
            "rounded-md overflow-hidden"
          )}>
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center animate-scale-in",
              isValid ? 'bg-green-100' : 'bg-red-100'
            )}>
              {isValid ? (
                <Check className="h-16 w-16 text-green-600" />
              ) : (
                <X className="h-16 w-16 text-red-600" />
              )}
            </div>
          </div>
          
          <div className="p-4 flex flex-col items-center gap-3">
            <h3 className={cn(
              "text-lg font-bold",
              isValid ? "text-green-700" : "text-red-700"
            )}>
              {isValid ? "BINGO WINNER!" : "Claim Rejected"}
            </h3>
            
            <p className="text-center">
              {isGlobalBroadcast 
                ? `${playerName} has ${isValid ? 'won!' : 'had their claim rejected'}`
                : `Your claim has been ${isValid ? 'validated!' : 'rejected'}`
              }
            </p>
            
            {/* The player's ticket display */}
            {ticketData && (
              <div className="w-full max-w-sm bg-gray-50 p-3 rounded-md border border-gray-200 mt-2">
                <SafeBingoTicketDisplay 
                  numbers={ticketData.numbers}
                  layoutMask={ticketData.layoutMask}
                  calledNumbers={ticketData.calledNumbers}
                  serial={ticketData.serial}
                  perm={ticketData.perm}
                  position={ticketData.position}
                  autoMarking={true}
                  showProgress={true}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
