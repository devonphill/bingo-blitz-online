
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { logWithTimestamp } from '@/utils/logUtils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Loader, X, Check } from 'lucide-react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';
import { cn } from '@/lib/utils';

interface ClaimOverlayPortalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  ticketData?: any;
  winPattern?: string;
  validationResult?: 'valid' | 'invalid' | null;
  autoClose?: boolean;
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
  winPattern,
  validationResult = null,
  autoClose = true
}: ClaimOverlayPortalProps) {
  const [domReady, setDomReady] = useState(false);
  const [shouldAutoClose, setShouldAutoClose] = useState(false);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);
  
  // Set up the portal container as early as possible
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    // Check if container already exists
    let container = document.getElementById('portal-claim-overlay');
    
    // Create container if it doesn't exist
    if (!container) {
      container = document.createElement('div');
      container.id = 'portal-claim-overlay';
      
      // Set a very high z-index to ensure it appears above everything else
      container.style.zIndex = '100000';
      document.body.appendChild(container);
      
      logWithTimestamp('ClaimOverlayPortal: Created portal container', 'info');
    }
    
    // Store the portal element for later use
    setPortalElement(container);
    
    // Mark DOM as ready
    setDomReady(true);
    
    return () => {
      // Don't remove container on unmount - other instances might use it
    };
  }, []);
  
  // Ensure portal visibility when needed
  useEffect(() => {
    if (isOpen && portalElement) {
      // Make sure the portal container is visible
      portalElement.style.display = 'block';
      
      // Log that we're showing the overlay
      logWithTimestamp(`ClaimOverlayPortal: Showing overlay for player ${playerName}, result: ${validationResult || 'checking'}, ticket: ${ticketData?.serial || 'unknown'}`, 'info');
    }
  }, [isOpen, portalElement, playerName, validationResult, ticketData]);
  
  // Auto-close logic for when a validation result is received
  useEffect(() => {
    if (validationResult && isOpen && autoClose) {
      setShouldAutoClose(true);
      // Close after 3 seconds to give users time to see the result
      const timer = setTimeout(() => {
        onClose();
        setShouldAutoClose(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [validationResult, isOpen, onClose, autoClose]);
  
  // Add debugging method to window for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugClaimOverlay = {
        isOpen,
        portalExists: !!portalElement,
        domReady,
        ticketData,
        forceShow: () => {
          setDomReady(true);
          if (portalElement) portalElement.style.display = 'block';
          logWithTimestamp('ClaimOverlayPortal: Forced show from debug', 'info');
        }
      };
    }
  }, [isOpen, portalElement, domReady, ticketData]);
  
  // Don't render anything if not open or DOM not ready
  if (!isOpen || !domReady || !portalElement) return null;
  
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
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-[100000]"
      style={{ 
        backdropFilter: 'blur(3px)',
      }}
      data-testid="portal-claim-overlay"
    >
      <Card className="w-[95vw] max-w-md bg-white shadow-xl animate-scale-in relative overflow-hidden">
        {/* Validation overlay - only shows when there's a result */}
        {validationResult && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center z-[100] bg-black/40 backdrop-blur-sm",
            "rounded-md overflow-hidden animate-fade-in"
          )}>
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center animate-scale-in",
              validationResult === 'valid' ? 'bg-green-100' : 'bg-red-100'
            )}>
              {validationResult === 'valid' ? (
                <Check className="h-20 w-20 text-green-600 animate-scale-in" />
              ) : (
                <X className="h-20 w-20 text-red-600 animate-scale-in" />
              )}
            </div>
          </div>
        )}
        
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
            {!validationResult && (
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Loader className="h-8 w-8 text-amber-600 animate-spin" />
              </div>
            )}
            
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
            
            {!validationResult && (
              <p className="text-center text-gray-600">
                The caller is checking this claim now...
              </p>
            )}
            
            {winPattern && (
              <div className="mt-2 px-4 py-2 bg-amber-50 rounded-md text-amber-700 text-center">
                Pattern: <span className="font-semibold">{winPattern}</span>
              </div>
            )}
            
            {/* Conditionally show close button only if we're not auto-closing */}
            {validationResult && !shouldAutoClose && (
              <Button 
                onClick={onClose}
                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white"
              >
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
  // Render using createPortal to ensure it's attached to the body
  return createPortal(
    overlayContent,
    portalElement
  );
}
