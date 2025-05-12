import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Debugging utilities specifically for claim notification issues
 */

/**
 * Adds global debug methods for claim functionality
 */
export function setupClaimDebugging() {
  logWithTimestamp('Setting up claim debugging tools', 'info');
  
  // Create global namespace for claim debugging
  if (typeof window !== 'undefined') {
    (window as any).debugClaims = {
      checkTicket: (ticketNumbers: number[], calledNumbers: number[]) => {
        console.log('Debug: Checking ticket', { ticketNumbers, calledNumbers });
        // Implementation logic
        return true;
      },
      
      validatePattern: (ticket: any, pattern: string, calledNumbers: number[]) => {
        console.log('Debug: Validating pattern', { ticket, pattern, calledNumbers });
        // Implementation logic
        return { isValid: true, matches: [] };
      },
      
      testClaim: (sessionId: string, ticketId: string) => {
        console.log('Debug: Testing claim', { sessionId, ticketId });
        // Implementation logic
        return { success: true, message: 'Claim verified' };
      },
      
      log: (message: string, data?: any) => {
        console.log(`ClaimDebug: ${message}`, data);
      }
    };
  }
  
  // Return cleanup function
  return () => {
    if (typeof window !== 'undefined') {
      delete (window as any).debugClaims;
    }
    logWithTimestamp('Cleaned up claim debugging tools', 'info');
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
