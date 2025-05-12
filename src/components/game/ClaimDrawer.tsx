
import React, { useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '../ui/drawer';
import { Button } from '../ui/button';
import { Trophy, Loader, X, Check } from 'lucide-react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';
import { cn } from '@/lib/utils';
import { logWithTimestamp } from '@/utils/logUtils';
import { toast } from 'sonner';

interface ClaimDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  ticketData?: any;
  winPattern?: string;
  validationResult?: 'valid' | 'invalid' | null;
  autoClose?: boolean;
}

/**
 * A slide-in bottom drawer component for displaying claim information
 */
export default function ClaimDrawer({
  isOpen,
  onOpenChange,
  playerName,
  ticketData,
  winPattern,
  validationResult = null,
  autoClose = true
}: ClaimDrawerProps) {
  // Enhanced logging for component lifecycle
  useEffect(() => {
    logWithTimestamp(`ClaimDrawer: Component mounted/updated - isOpen=${isOpen}`, 'debug');
    
    // Add component to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).claimDrawerDebug = {
        getProps: () => ({ isOpen, playerName, ticketData, winPattern, validationResult }),
        forceOpen: (data: any = null) => {
          logWithTimestamp(`ClaimDrawer: Force opening via debug method`, 'info');
          if (data) {
            // Create a custom event that BingoClaim can listen to
            const event = new CustomEvent('forceOpenClaimDrawer', { 
              detail: { 
                data: data || {
                  playerName: 'Debug Player',
                  ticketData: ticketData || { serial: 'DEBUG123' }
                }
              }
            });
            window.dispatchEvent(event);
          }
          onOpenChange(true);
          return 'Drawer should be opening now';
        }
      };
    }
    
    return () => {
      logWithTimestamp(`ClaimDrawer: Component will unmount`, 'debug');
      if (typeof window !== 'undefined') {
        delete (window as any).claimDrawerDebug;
      }
    };
  }, [isOpen, playerName, ticketData, winPattern, validationResult, onOpenChange]);
  
  // Auto-close logic for when a validation result is received
  useEffect(() => {
    if (validationResult && isOpen && autoClose) {
      logWithTimestamp(`ClaimDrawer: Auto-close timer started for ${validationResult} result`, 'info');
      // Close after 3 seconds to give users time to see the result
      const timer = setTimeout(() => {
        logWithTimestamp(`ClaimDrawer: Auto-closing now`, 'info');
        onOpenChange(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [validationResult, isOpen, onOpenChange, autoClose]);

  // Log when the drawer opens or closes
  useEffect(() => {
    if (isOpen) {
      logWithTimestamp(`ClaimDrawer: OPENED for player ${playerName}, result: ${validationResult || 'checking'}, ticket: ${ticketData?.serial || 'unknown'}`, 'info');
      // Show a toast when the drawer opens for additional visibility
      toast.info(`Claim check for ${playerName}`, { 
        id: `claim-drawer-${Date.now()}`,
        description: "Checking ticket details..."
      });
    } else {
      logWithTimestamp(`ClaimDrawer: CLOSED`, 'info');
    }
  }, [isOpen, playerName, validationResult, ticketData]);

  // Process ticket data if available
  const processedTicketData = React.useMemo(() => {
    if (!ticketData) return null;
    
    return {
      numbers: ticketData.numbers || [],
      layoutMask: ticketData.layoutMask || ticketData.layout_mask || 0,
      calledNumbers: ticketData.calledNumbers || [],
      serial: ticketData.serial || 'Unknown',
      perm: ticketData.perm || 0,
      position: ticketData.position || 0
    };
  }, [ticketData]);

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onOpenChange}
    >
      <DrawerContent className="px-4">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="relative">
            <div className="flex items-center gap-2 justify-center">
              <Trophy className="h-5 w-5 text-amber-500" />
              <DrawerTitle className="text-xl">Bingo Claim Check</DrawerTitle>
            </div>
          </DrawerHeader>
          
          <div className="p-4">
            <div className="flex flex-col items-center gap-4">
              {/* Validation result indicator */}
              {validationResult && (
                <div className={cn(
                  "absolute inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm",
                  "rounded-md overflow-hidden animate-fade-in"
                )}>
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center animate-scale-in",
                    validationResult === 'valid' ? 'bg-green-100' : 'bg-red-100'
                  )}>
                    {validationResult === 'valid' ? (
                      <Check className="h-12 w-12 text-green-600" />
                    ) : (
                      <X className="h-12 w-12 text-red-600" />
                    )}
                  </div>
                </div>
              )}

              {/* Checking indicator */}
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
            </div>
          </div>
          
          <DrawerFooter className="flex justify-center">
            {/* Show close button only if we're not auto-closing */}
            {validationResult && !autoClose && (
              <Button 
                onClick={() => onOpenChange(false)}
                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white"
              >
                Close
              </Button>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
