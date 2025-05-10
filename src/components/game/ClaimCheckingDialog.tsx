
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Loader } from 'lucide-react';
import { logWithTimestamp, logElementVisibility } from '@/utils/logUtils';

interface ClaimCheckingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimData: any | null;
}

export default function ClaimCheckingDialog({ isOpen, onClose, claimData }: ClaimCheckingDialogProps) {
  const playerName = claimData?.playerName || 'A player';
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Log when dialog open state changes
  useEffect(() => {
    logWithTimestamp(`ClaimCheckingDialog: isOpen changed to ${isOpen}, playerName=${playerName}`, 'info');
    
    if (isOpen && claimData) {
      // Log dialog data for debugging
      logWithTimestamp(`ClaimCheckingDialog: Opened with data: ${JSON.stringify({
        playerName: claimData.playerName,
        winPattern: claimData.winPattern,
        hasTicket: !!claimData.ticket
      })}`, 'info');
      
      // Check DOM visibility after a short delay
      setTimeout(() => {
        logElementVisibility('[role="dialog"]', 'Dialog Component');
        
        // Try to find dialog content directly
        const dialogContent = document.querySelector('[role="dialog"] .DialogContent');
        if (dialogContent) {
          logWithTimestamp('Found dialog content in DOM', 'info');
        } else {
          logWithTimestamp('Dialog content not found in DOM', 'warn');
        }
      }, 200);
    }
  }, [isOpen, claimData, playerName]);
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent 
          ref={dialogRef}
          className="w-[95vw] max-w-md rounded-lg fixed z-[2000] bg-white"
          style={{ zIndex: 2000 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center text-xl gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span>Bingo Claim Check</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center p-4 gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <Loader className="h-8 w-8 text-amber-600 animate-spin" />
            </div>
            
            <h3 className="text-lg font-semibold text-center">
              {playerName} has claimed Bingo!
            </h3>
            
            <p className="text-center text-gray-600">
              The caller is checking this claim now. Please wait...
            </p>
            
            {claimData?.winPattern && (
              <div className="text-sm text-gray-500 text-center">
                Pattern: {claimData.winPattern}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Fallback notification if dialog doesn't render properly */}
      {isOpen && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white p-3 text-center z-[9999] shadow-lg">
          {playerName} has claimed Bingo! The caller is checking this claim now.
        </div>
      )}
    </>
  );
}
