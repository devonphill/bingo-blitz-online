
import { logWithTimestamp } from './logUtils';

/**
 * Debugging utilities specifically for claim notification issues
 */

/**
 * Adds global debug methods for claim functionality
 */
export function setupClaimDebugging() {
  if (typeof window === 'undefined') return;
  
  // Store original values to avoid overwriting existing functions
  const originalMethods = {
    showClaimOverlay: (window as any).showClaimOverlay,
    toggleClaimOverlay: (window as any).toggleClaimOverlay,
    debugClaimSheet: (window as any).debugClaimSheet
  };
  
  // Add enhanced global debug methods
  (window as any).debugClaims = {
    forceOpenDrawer: (data = null) => {
      logWithTimestamp('Force opening claim drawer via debugClaims', 'info');
      
      // Try multiple methods to ensure it works
      
      // Method 1: Use the debugClaimSheet API if it exists
      if ((window as any).debugClaimSheet?.show) {
        logWithTimestamp('Using debugClaimSheet.show() to open drawer', 'debug');
        (window as any).debugClaimSheet.show(data);
      }
      
      // Method 2: Dispatch a custom event for BingoClaim to listen to
      const event = new CustomEvent('forceOpenClaimDrawer', { 
        detail: { 
          data: data || {
            playerName: 'Debug Player',
            ticket: {
              serial: 'DEBUG123',
              numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
              layoutMask: 110616623,
              calledNumbers: [1, 2, 3]
            },
            winPattern: 'oneLine'
          }
        }
      });
      logWithTimestamp('Dispatching forceOpenClaimDrawer event', 'debug');
      window.dispatchEvent(event);
      
      // Method 3: Try to manually call the drawer's debug API
      if ((window as any).claimDrawerDebug?.forceOpen) {
        logWithTimestamp('Using claimDrawerDebug.forceOpen() to open drawer', 'debug');
        return (window as any).claimDrawerDebug.forceOpen(data);
      }
      
      return "Attempted to open claim drawer using multiple methods";
    },
    
    simulateValidation: (isValid = true) => {
      logWithTimestamp(`Simulating claim ${isValid ? 'validation' : 'rejection'}`, 'info');
      
      // Get current claim data if available
      const currentData = (window as any).debugClaimSheet?.getStatus?.() || {};
      const simulatedResult = {
        ...currentData.data,
        playerName: currentData.data?.playerName || 'Test Player',
        result: isValid ? 'valid' : 'invalid'
      };
      
      // Try to find and update the claim drawer directly
      if ((window as any).document.querySelector('[role="dialog"]')) {
        const event = new CustomEvent('claimValidation', {
          detail: {
            result: isValid ? 'valid' : 'invalid',
            data: simulatedResult
          }
        });
        window.dispatchEvent(event);
      }
      
      return `Simulated ${isValid ? 'validation' : 'rejection'} of claim`;
    },
    
    getCurrentState: () => {
      // Try to get state from multiple sources
      const drawerState = (window as any).claimDrawerDebug?.getProps ? 
        (window as any).claimDrawerDebug.getProps() : 'Not available';
      
      const sheetState = (window as any).debugClaimSheet?.getStatus ? 
        (window as any).debugClaimSheet.getStatus() : 'Not available';
      
      return {
        drawerProps: drawerState,
        sheetStatus: sheetState,
        elementsFound: {
          debugClaimSheet: !!(window as any).debugClaimSheet,
          claimDrawerDebug: !!(window as any).claimDrawerDebug,
          drawerElement: !!document.querySelector('[role="dialog"]')
        }
      };
    },
    
    showTestToast: (message = "Test claim notification") => {
      // Import on-demand to avoid bundling issues
      import('sonner').then(({ toast }) => {
        toast.info("Bingo Claim Test", {
          description: message,
          duration: 5000,
          action: {
            label: "Open Drawer",
            onClick: () => (window as any).debugClaims.forceOpenDrawer()
          }
        });
      });
      
      return "Test toast displayed";
    }
  };
  
  logWithTimestamp('Claim debugging utilities installed on window.debugClaims', 'info');
  console.log('Claim debugging available at window.debugClaims');
  
  return () => {
    // Restore original values when cleaning up
    if (originalMethods.showClaimOverlay) {
      (window as any).showClaimOverlay = originalMethods.showClaimOverlay;
    } else {
      delete (window as any).showClaimOverlay;
    }
    
    if (originalMethods.toggleClaimOverlay) {
      (window as any).toggleClaimOverlay = originalMethods.toggleClaimOverlay;
    } else {
      delete (window as any).toggleClaimOverlay;
    }
    
    if (originalMethods.debugClaimSheet) {
      (window as any).debugClaimSheet = originalMethods.debugClaimSheet;
    } else {
      delete (window as any).debugClaimSheet;
    }
    
    delete (window as any).debugClaims;
  };
}

/**
 * Test the drawer visibility by attempting to open it
 */
export function testDrawerVisibility() {
  try {
    // Show info in console for debugging
    logWithTimestamp('Testing claim drawer visibility...', 'info');
    
    // Create a test claim with validation state
    const testClaim = {
      id: `test-${Date.now()}`,
      playerName: 'Visibility Test',
      ticket: {
        serial: 'VISTEST',
        numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        layoutMask: 110616623, 
        calledNumbers: [1, 2, 3]
      },
      winPattern: 'oneLine'
    };
    
    // Try multiple methods to open the drawer
    if ((window as any).debugClaimSheet?.show) {
      logWithTimestamp('Using debugClaimSheet.show()', 'debug');
      (window as any).debugClaimSheet.show(testClaim);
    }
    
    if ((window as any).claimDrawerDebug?.forceOpen) {
      logWithTimestamp('Using claimDrawerDebug.forceOpen()', 'debug');
      (window as any).claimDrawerDebug.forceOpen(testClaim);
    }
    
    if ((window as any).debugClaims?.forceOpenDrawer) {
      logWithTimestamp('Using debugClaims.forceOpenDrawer()', 'debug');
      (window as any).debugClaims.forceOpenDrawer(testClaim);
    }
    
    // Dispatch event as a fallback
    const event = new CustomEvent('forceOpenClaimDrawer', { 
      detail: { data: testClaim }
    });
    window.dispatchEvent(event);
    
    // After a delay, simulate validation
    setTimeout(() => {
      if ((window as any).debugClaims?.simulateValidation) {
        (window as any).debugClaims.simulateValidation(true);
      }
    }, 2000);
    
    return true;
  } catch (err) {
    console.error("Error testing drawer visibility:", err);
    return false;
  }
}
