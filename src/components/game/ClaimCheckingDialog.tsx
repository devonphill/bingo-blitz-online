
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
          
          // Try to force a new dialog using DOM manipulation if the React component failed
          try {
            const existingFallback = document.getElementById('emergency-dialog-fallback');
            if (!existingFallback) {
              const fallbackDialog = document.createElement('div');
              fallbackDialog.id = 'emergency-dialog-fallback';
              fallbackDialog.style.position = 'fixed';
              fallbackDialog.style.top = '50%';
              fallbackDialog.style.left = '50%';
              fallbackDialog.style.transform = 'translate(-50%, -50%)';
              fallbackDialog.style.backgroundColor = 'white';
              fallbackDialog.style.padding = '1rem';
              fallbackDialog.style.borderRadius = '0.5rem';
              fallbackDialog.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
              fallbackDialog.style.zIndex = '99999';
              fallbackDialog.innerHTML = `
                <h3 style="font-weight: bold; font-size: 1.2rem; margin-bottom: 0.5rem;">Bingo Claim</h3>
                <p>${playerName} has claimed Bingo!</p>
                <p style="margin-top: 0.5rem; color: #666;">The caller is checking this claim now...</p>
                <button 
                  style="margin-top: 1rem; width: 100%; background: #3b82f6; color: white; padding: 0.5rem; border-radius: 0.25rem; cursor: pointer;"
                  onclick="document.body.removeChild(document.getElementById('emergency-dialog-fallback'))"
                >
                  Close
                </button>
              `;
              document.body.appendChild(fallbackDialog);
            }
          } catch (err) {
            logWithTimestamp(`Error creating emergency dialog: ${(err as Error).message}`, 'error');
          }
        }
      }, 200);
    }
  }, [isOpen, claimData, playerName]);
  
  return (
    <>
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => !open && onClose()}
        defaultOpen={isOpen}
      >
        <DialogContent 
          ref={dialogRef}
          className="w-[95vw] max-w-md rounded-lg fixed z-[2000] bg-white shadow-xl"
          style={{ zIndex: 9999 }}
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
      
      {/* Extra fallback notification if dialog doesn't render properly - always render when open */}
      {isOpen && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white p-3 text-center z-[9999] shadow-lg">
          {playerName} has claimed Bingo! The caller is checking this claim now.
        </div>
      )}
    </>
  );
}
