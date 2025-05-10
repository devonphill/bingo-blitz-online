
import React, { useEffect, useRef } from 'react';
import { Trophy, X, Loader } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logWithTimestamp, logElementVisibility } from '@/utils/logUtils';

interface FixedClaimOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  claimData: any | null;
}

export default function FixedClaimOverlay({ isVisible, onClose, claimData }: FixedClaimOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const playerName = claimData?.playerName || 'A player';
  
  // Log visibility changes and verify DOM rendering
  useEffect(() => {
    logWithTimestamp(`FixedClaimOverlay: Visibility state changed to ${isVisible}`, 'info');
    
    if (isVisible) {
      // Log for debugging
      logWithTimestamp(`FixedClaimOverlay: Displaying for ${playerName}`, 'info');
      console.log('FixedClaimOverlay claimData:', claimData);
      
      // Check if element is actually visible in DOM after a short delay
      setTimeout(() => {
        if (overlayRef.current) {
          logElementVisibility('.fixed-claim-overlay', 'Fixed Claim Overlay');
        } else {
          logWithTimestamp('FixedClaimOverlay: Element not found in DOM after mounting', 'warn');
        }
      }, 100);
    }
  }, [isVisible, playerName, claimData]);
  
  if (!isVisible) return null;
  
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/40 z-[9999] fixed-claim-overlay"
      ref={overlayRef}
    >
      <Card className="w-[95vw] max-w-md bg-white shadow-xl animate-fade-in">
        <CardHeader className="relative">
          <Button 
            onClick={onClose}
            variant="ghost" 
            size="sm" 
            className="absolute right-2 top-2"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 justify-center">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-xl">Bingo Claim Check</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
