
import { useState, useEffect, useCallback } from 'react';
import { logDebug, logWithTimestamp } from './logUtils';

// Create a counter for unique IDs
let idCounter = 0;

/**
 * A polyfill for React 18's useId hook that works with React 17
 * This generates a unique ID during component initialization
 * @param prefix Optional prefix for the generated ID
 * @returns A unique string ID
 */
export function useIdPolyfill(prefix: string = 'id-'): string {
  const [id] = useState(() => {
    const generatedId = `${prefix}${idCounter++}`;
    logDebug(`[ReactUtils] Generated ID: ${generatedId}`);
    return generatedId;
  });
  return id;
}

/**
 * Safe version of useId that works with both React 17 and React 18
 * Use this instead of React.useId() directly
 * @param prefix Optional prefix for the generated ID
 * @returns A unique string ID
 */
export function useSafeId(prefix: string = 'id-'): string {
  // Capture stack trace to find caller
  const stackTrace = new Error().stack || '';
  const callerInfo = getCallerInfo(stackTrace);
  
  // Log detailed information about who's calling this function
  logDebug(`[ReactUtils] useSafeId called from ${callerInfo.component || 'unknown'} in ${callerInfo.file || 'unknown file'}`);
  
  try {
    // Check if we're in a React 18 environment with native useId
    // @ts-ignore - We're checking for React 18's useId function
    const ReactModule = typeof React !== 'undefined' ? React : null;
    if (ReactModule && typeof ReactModule.useId === 'function') {
      logDebug('[ReactUtils] Using native React.useId');
      // @ts-ignore - We've already checked that it exists
      return ReactModule.useId(prefix);
    }
    
    // For React 17, we use our polyfill
    logDebug('[ReactUtils] Using useId polyfill for React 17');
    return useIdPolyfill(prefix);
  } catch (error) {
    // If any error occurs, fall back to our polyfill
    logWithTimestamp(`[ReactUtils] Error using React.useId, falling back to polyfill: ${error}`, 'warn');
    return useIdPolyfill(prefix);
  }
}

/**
 * Helper function to log React environment information
 * This can help debug React version compatibility issues
 */
export function logReactEnvironment() {
  try {
    // Try to access React directly
    // @ts-ignore - Access React from window for debugging
    const reactGlobal = typeof React !== 'undefined' ? React : (window.React || null);
    const reactVersion = reactGlobal?.version || 'unknown';
    const isReactInWindow = !!reactGlobal;
    const hasUseId = typeof reactGlobal?.useId === 'function';
    
    logWithTimestamp(`[ReactEnv] React version: ${reactVersion}`, 'debug');
    logWithTimestamp(`[ReactEnv] React ${isReactInWindow ? 'found' : 'not found'} in global scope`, 'debug');
    logWithTimestamp(`[ReactEnv] React.useId ${hasUseId ? 'is available' : 'is NOT available'} (React 18+ only)`, 'debug');
    
    return { reactVersion, isReactInWindow, hasUseId };
  } catch (e) {
    logWithTimestamp(`[ReactEnv] Error checking React environment: ${e}`, 'error');
    return { reactVersion: 'error', isReactInWindow: false, hasUseId: false };
  }
}

/**
 * Attempts to determine the name of the calling component and file
 * from a stack trace string.
 */
function getCallerInfo(stack: string): { component: string | null; file: string | null } {
  try {
    const stackLines = stack.split('\n');
    let component = null;
    let file = null;
    
    // Skip the first few lines which are this function and its callers
    for (let i = 3; i < stackLines.length; i++) {
      const line = stackLines[i];
      
      // Look for capitalized function names which are likely components
      const componentMatch = line.match(/at ([A-Z][A-Za-z0-9$_]+)/);
      if (componentMatch && componentMatch[1] && !component) {
        component = componentMatch[1];
      }
      
      // Try to extract filename
      const fileMatch = line.match(/\((.+?):\d+:\d+\)$/);
      if (fileMatch && fileMatch[1] && !file) {
        // Extract just the filename, not the full path
        const fullPath = fileMatch[1];
        const pathParts = fullPath.split(/[\/\\]/);
        file = pathParts[pathParts.length - 1];
      }
      
      if (component && file) break;
    }
    
    return { component, file };
  } catch (e) {
    return { component: null, file: null };
  }
}

/**
 * Attempts to determine the name of the calling component
 * This is a best-effort approach and may not work in all cases
 */
function getCallerComponentName(): string | null {
  try {
    const err = new Error();
    const stackLines = err.stack?.split('\n') || [];
    
    // Skip the first few lines which are this function and its callers
    for (let i = 3; i < stackLines.length; i++) {
      const line = stackLines[i];
      // Look for capitalized function names which are likely components
      const match = line.match(/at ([A-Z][A-Za-z0-9$_]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Utility to patch React global object
 * This should be called at app start to ensure React.useId doesn't throw errors
 */
export function patchReactForIdPolyfill() {
  try {
    // @ts-ignore - We're intentionally patching the global React object
    if (typeof React !== 'undefined' && !React.useId) {
      logWithTimestamp('[ReactUtils] Patching React global object with useId polyfill', 'info');
      
      // @ts-ignore - Add our polyfill to global React
      React.useId = useIdPolyfill;
      
      logWithTimestamp('[ReactUtils] Successfully patched React.useId', 'info');
      return true;
    }
    return false;
  } catch (e) {
    logWithTimestamp(`[ReactUtils] Error patching React: ${e}`, 'error');
    return false;
  }
}
