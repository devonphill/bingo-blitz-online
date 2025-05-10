
import React, { useEffect, useRef, useState } from 'react';
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
  
  if (!isVisible) return null;
  
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
      <Card className="w-[95vw] max-w-md bg-white shadow-xl animate-scale-in">
        <CardHeader className="relative bg-amber-50">
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
            
            <p className="text-center text-gray-600">
              The caller is checking this claim now. Please wait...
            </p>
            
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
