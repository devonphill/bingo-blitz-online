
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
  // Add more detailed logging to track usage
  const stackTrace = new Error().stack || '';
  const callerInfo = getCallerInfo(stackTrace);
  logDebug(`[ReactUtils] useSafeId called from ${callerInfo.component || 'unknown'} in ${callerInfo.file || 'unknown file'}`);
  
  // For React 17, we use our polyfill
  return useIdPolyfill(prefix);
  
  // In future, this could be updated to check for React 18's useId
  // and use that when available
}

/**
 * Helper function to log React environment information
 * This can help debug React version compatibility issues
 */
export function logReactEnvironment() {
  try {
    // @ts-ignore - Access React from window for debugging
    const reactVersion = window.React?.version || 'unknown';
    const isReactInWindow = !!(window as any).React;
    const hasUseId = typeof (window as any).React?.useId === 'function';
    
    logWithTimestamp(`[ReactEnv] React version: ${reactVersion}`, 'debug');
    logWithTimestamp(`[ReactEnv] React ${isReactInWindow ? 'found' : 'not found'} in window object`, 'debug');
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
