
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { logWithTimestamp } from '@/utils/logUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Loader, X } from 'lucide-react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';

interface ClaimOverlayPortalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  ticketData?: any;
  winPattern?: string;
}

/**
 * A Portal-based claim overlay for maximum compatibility
 * This addresses issues with other overlay techniques by mounting directly to the body
 */
export default function ClaimOverlayPortal({
  isOpen,
  onClose,
  playerName,
  ticketData,
  winPattern
}: ClaimOverlayPortalProps) {
  const [domReady, setDomReady] = useState(false);
  
  // Set up the portal container
  useEffect(() => {
    // Only run in browser
    if (typeof document === 'undefined') return;
    
    // Check if container already exists
    let container = document.getElementById('portal-claim-overlay');
    
    // Create container if it doesn't exist
    if (!container) {
      container = document.createElement('div');
      container.id = 'portal-claim-overlay';
      document.body.appendChild(container);
      logWithTimestamp('ClaimOverlayPortal: Created portal container', 'info');
    }
    
    // Mark DOM as ready
    setDomReady(true);
    
    return () => {
      // Don't remove container on unmount - other instances might use it
    };
  }, []);
  
  // Don't render anything if not open or DOM not ready
  if (!isOpen || !domReady) return null;
  
  // Process ticket data if available
  const processedTicketData = ticketData ? {
    numbers: ticketData.numbers || [],
    layoutMask: ticketData.layoutMask || ticketData.layout_mask || 0,
    calledNumbers: ticketData.calledNumbers || [],
    serial: ticketData.serial || 'Unknown',
    perm: ticketData.perm || 0,
    position: ticketData.position || 0
  } : null;
  
  // Create the portal content
  const overlayContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-[100000] animate-fade-in"
      style={{ 
        backdropFilter: 'blur(3px)',
      }}
      data-testid="portal-claim-overlay"
    >
      <Card className="w-[95vw] max-w-md bg-white shadow-xl animate-scale-in relative overflow-hidden">
        <CardHeader className="relative bg-amber-50">
          <Button 
            onClick={onClose}
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2 rounded-full hover:bg-red-100 hover:text-red-600"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-red-500" />
          </Button>
          <div className="flex items-center gap-2 justify-center">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-xl animate-pulse">Bingo Claim Check</CardTitle>
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
            
            {/* The player's ticket display */}
            {processedTicketData && (
              <div className="w-full max-w-sm bg-gray-50 p-3 rounded-md border border-gray-200">
                <SafeBingoTicketDisplay 
                  numbers={processedTicketData.numbers}
                  layoutMask={processedTicketData.layoutMask}
                  calledNumbers={processedTicketData.calledNumbers}
                  serial={processedTicketData.serial}
                  perm={processedTicketData.perm}
                  position={processedTicketData.position}
                  autoMarking={true}
                  showProgress={true}
                />
              </div>
            )}
            
            <p className="text-center text-gray-600">
              The caller is checking this claim now...
            </p>
            
            {winPattern && (
              <div className="mt-2 px-4 py-2 bg-amber-50 rounded-md text-amber-700 text-center">
                Pattern: <span className="font-semibold">{winPattern}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
  // Render using createPortal to ensure it's attached to the body
  return createPortal(
    overlayContent,
    document.getElementById('portal-claim-overlay')!
  );
}
