
import React, { useEffect, useRef, useState } from 'react';
import { X, Trophy, Loader, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logWithTimestamp, logElementVisibility } from '@/utils/logUtils';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';
import { cn } from '@/lib/utils';

interface FixedClaimOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  claimData: any | null;
  validationResult?: 'valid' | 'invalid' | null;
}

export default function FixedClaimOverlay({ 
  isVisible, 
  onClose, 
  claimData,
  validationResult = null
}: FixedClaimOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const playerName = claimData?.playerName || 'A player';
  const [shouldAutoClose, setShouldAutoClose] = useState(false);
  
  // Add a key state to force re-render when visibility changes
  const [renderKey, setRenderKey] = useState(0);
  
  // Log visibility changes and verify DOM rendering
  useEffect(() => {
    logWithTimestamp(`FixedClaimOverlay: Visibility state changed to ${isVisible}`, 'info');
    
    if (isVisible) {
      // Force a re-render with a new key to ensure React updates the DOM
      setRenderKey(prev => prev + 1);
      
      // Log for debugging
      logWithTimestamp(`FixedClaimOverlay: Displaying for ${playerName}`, 'info');
      console.log('FixedClaimOverlay claimData:', claimData);
      
      // Check if element is actually visible in DOM after a short delay
      setTimeout(() => {
        if (overlayRef.current) {
          logElementVisibility('.fixed-claim-overlay', 'Fixed Claim Overlay');
          
          // Try to measure its position and dimensions for debugging
          const rect = overlayRef.current.getBoundingClientRect();
          logWithTimestamp(`FixedClaimOverlay position: x=${rect.left}, y=${rect.top}, width=${rect.width}, height=${rect.height}`, 'info');
          
          // Check if parent elements might be hiding it
          let parent = overlayRef.current.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const style = window.getComputedStyle(parent);
            logWithTimestamp(`Parent ${depth} style: position=${style.position}, z-index=${style.zIndex}, overflow=${style.overflow}`, 'debug');
            parent = parent.parentElement;
            depth++;
          }
        } else {
          logWithTimestamp('FixedClaimOverlay: Element not found in DOM after mounting', 'warn');
        }
      }, 100);
    }
  }, [isVisible, playerName, claimData]);
  
  // Insert the overlay directly into body when visible for maximum z-index effectiveness
  useEffect(() => {
    // Create a direct body-level container for the overlay if needed
    if (isVisible && typeof document !== 'undefined') {
      // Check if our container already exists
      let container = document.getElementById('fixed-overlay-container');
      
      if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = 'fixed-overlay-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.zIndex = '10000'; // Very high z-index
        container.style.pointerEvents = 'none'; // Let clicks through by default
        document.body.appendChild(container);
        
        logWithTimestamp('Created body-level container for fixed overlay', 'info');
      }
      
      // Enable pointer events when overlay is active
      container.style.pointerEvents = 'auto';
      
      return () => {
        // Disable pointer events when overlay is hidden
        if (container) {
          container.style.pointerEvents = 'none';
        }
      };
    }
  }, [isVisible]);
  
  // Auto-close logic for when a validation result is received
  useEffect(() => {
    if (validationResult && isVisible) {
      setShouldAutoClose(true);
      // Close after 3 seconds to give users time to see the result
      const timer = setTimeout(() => {
        onClose();
        setShouldAutoClose(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [validationResult, isVisible, onClose]);
  
  if (!isVisible) return null;

  // Check if we have ticket data to display
  const hasTicket = claimData?.ticket && (
    Array.isArray(claimData.ticket.numbers) || 
    Array.isArray(claimData.ticket.calledNumbers)
  );
  
  // Get ticket data from claim payload
  const ticketData = hasTicket ? {
    numbers: claimData.ticket.numbers || [],
    layoutMask: claimData.ticket.layoutMask || claimData.ticket.layout_mask || 0,
    calledNumbers: claimData.calledNumbers || claimData.ticket.calledNumbers || [],
    serial: claimData.ticket.serial || 'Unknown',
    perm: claimData.ticket.perm || 0,
    position: claimData.ticket.position || 0
  } : null;
  
  return (
    <div 
      key={`overlay-${renderKey}`}
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-[9999] fixed-claim-overlay animate-fade-in"
      ref={overlayRef}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(3px)'
      }}
    >
      <Card className="w-[95vw] max-w-md bg-white shadow-xl animate-scale-in relative">
        {/* Validation overlay - only shows when there's a result */}
        {validationResult && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center z-[100] bg-black/40 backdrop-blur-sm animate-fade-in",
            "rounded-md overflow-hidden"
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
            {ticketData && (
              <div className="w-full max-w-sm bg-gray-50 p-3 rounded-md border border-gray-200">
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
            
            {!validationResult && (
              <p className="text-center text-gray-600">
                The caller is checking this claim now. Please wait...
              </p>
            )}
            
            {claimData?.winPattern && (
              <div className="mt-2 px-4 py-2 bg-amber-50 rounded-md text-amber-700 text-center">
                Pattern: <span className="font-semibold">{claimData.winPattern}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
