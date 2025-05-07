
import { useState, useEffect } from 'react';

// Create a counter for unique IDs
let idCounter = 0;

/**
 * A polyfill for React 18's useId hook that works with React 17
 * This generates a unique ID during component initialization
 */
export function useIdPolyfill(prefix: string = 'id-'): string {
  const [id] = useState(() => `${prefix}${idCounter++}`);
  return id;
}

/**
 * Safe version of useId that works with both React 17 and React 18
 * Use this instead of React.useId() directly
 */
export function useSafeId(prefix: string = 'id-'): string {
  return useIdPolyfill(prefix);
}
