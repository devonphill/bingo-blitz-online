
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Loader } from 'lucide-react';

interface ClaimCheckingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimData: any | null;
}

export default function ClaimCheckingDialog({ isOpen, onClose, claimData }: ClaimCheckingDialogProps) {
  const playerName = claimData?.playerName || 'A player';
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-md rounded-lg">
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
  );
}
