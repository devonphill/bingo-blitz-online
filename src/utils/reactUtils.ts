
import { useState, useEffect } from 'react';
import { logDebug } from './logUtils';

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
  // For React 17, we use our polyfill
  return useIdPolyfill(prefix);
  
  // In future, this could be updated to check for React 18's useId
  // and use that when available
}

