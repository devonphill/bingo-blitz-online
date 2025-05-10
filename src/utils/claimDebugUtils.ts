
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
    toggleClaimOverlay: (window as any).toggleClaimOverlay
  };
  
  // Add global methods for debugging
  (window as any).debugClaims = {
    checkOverlayStatus: () => {
      const overlayElement = document.querySelector('.fixed-claim-overlay');
      logWithTimestamp(`Claim overlay element exists: ${!!overlayElement}`, 'info');
      
      if (overlayElement) {
        const styles = window.getComputedStyle(overlayElement);
        logWithTimestamp(`Overlay styles - display: ${styles.display}, visibility: ${styles.visibility}, z-index: ${styles.zIndex}`, 'info');
        
        // Check if it's actually visible
        const rect = overlayElement.getBoundingClientRect();
        logWithTimestamp(`Overlay size: ${rect.width}x${rect.height}, position: (${rect.top}, ${rect.left})`, 'info');
      }
      
      return {
        exists: !!overlayElement,
        visible: !!overlayElement && overlayElement.getBoundingClientRect().height > 0
      };
    },
    
    showTestOverlay: (data = null) => {
      const testData = data || {
        playerName: 'Test Player',
        ticket: {
          serial: 'TEST1234',
          numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          layoutMask: 110616623,
          calledNumbers: [1, 2, 3]
        },
        winPattern: 'oneLine'
      };
      
      if ((window as any).showClaimOverlay) {
        (window as any).showClaimOverlay(testData);
        return true;
      }
      
      return false;
    },
    
    forceShowOverlay: () => {
      // Create an overlay element and attach it directly to the body
      // as a last resort for testing
      const div = document.createElement('div');
      div.className = 'emergency-test-overlay';
      div.style.position = 'fixed';
      div.style.top = '0';
      div.style.left = '0';
      div.style.right = '0';
      div.style.bottom = '0';
      div.style.background = 'rgba(0,0,0,0.7)';
      div.style.zIndex = '100002';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      
      const content = document.createElement('div');
      content.style.background = 'white';
      content.style.padding = '20px';
      content.style.borderRadius = '8px';
      content.innerHTML = `
        <h2>Emergency Test Overlay</h2>
        <p>This is a direct DOM test of overlay visibility</p>
        <button id="close-test-overlay" style="padding: 8px 16px; background: red; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      `;
      
      div.appendChild(content);
      document.body.appendChild(div);
      
      // Add close handler
      document.getElementById('close-test-overlay')?.addEventListener('click', () => {
        document.body.removeChild(div);
      });
      
      return true;
    },
    
    checkZIndexes: () => {
      // Find the highest z-index in the page to debug stacking issues
      const elements = document.querySelectorAll('*');
      let highestZ = 0;
      let highestElement = null;
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        if (!isNaN(zIndex) && zIndex > highestZ) {
          highestZ = zIndex;
          highestElement = el;
        }
      });
      
      return {
        highestZ,
        highestElement: highestElement ? `${highestElement.tagName}${highestElement.className ? '.' + highestElement.className : ''}` : null
      };
    }
  };
  
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
    
    delete (window as any).debugClaims;
  };
}

/**
 * Check if any element could block the claim overlay
 */
export function checkForBlockingElements() {
  if (typeof window === 'undefined') return null;
  
  const overlayElement = document.querySelector('.fixed-claim-overlay');
  if (!overlayElement) return null;
  
  const overlayZIndex = parseInt(window.getComputedStyle(overlayElement).zIndex) || 0;
  const potentialBlockers: {element: string, zIndex: number}[] = [];
  
  document.querySelectorAll('*').forEach(el => {
    if (el === overlayElement) return;
    
    const style = window.getComputedStyle(el);
    const zIndex = parseInt(style.zIndex);
    
    if (!isNaN(zIndex) && zIndex >= overlayZIndex && style.position !== 'static') {
      potentialBlockers.push({
        element: `${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`,
        zIndex
      });
    }
  });
  
  return potentialBlockers;
}

/**
 * Test the overlay visibility by trying different methods
 */
export function testOverlayVisibility() {
  // Method 1: Check if in DOM
  const overlayInDom = !!document.querySelector('.fixed-claim-overlay');
  
  // Method 2: Check if visible (has dimensions)
  const overlayElement = document.querySelector('.fixed-claim-overlay');
  const hasVisibleDimensions = overlayElement ? overlayElement.getBoundingClientRect().height > 0 : false;
  
  // Method 3: Check if blocked by other elements
  const blockers = checkForBlockingElements();
  
  return {
    inDom: overlayInDom,
    hasVisibleDimensions,
    potentialBlockers: blockers
  };
}
