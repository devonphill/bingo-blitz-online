
import React from 'react';
import { logWithTimestamp } from './logUtils';
import { useSafeInsertionEffect } from './reactUtils';

/**
 * This is a compatibility layer for styled-components and emotion
 * that might be using useInsertionEffect under the hood
 */

/**
 * Safely run style insertion effects for CSS-in-JS libraries
 * @param callback The style insertion callback
 * @param deps Dependencies array
 */
export function useStyledInsertionEffect(callback: () => void | (() => void), deps?: React.DependencyList) {
  useSafeInsertionEffect(callback, deps);
}

/**
 * Check if a style-related error occurs and provide helpful debug information
 * @param error The error object
 * @returns True if the error was style-related
 */
export function handleStyleError(error: unknown): boolean {
  const errorString = String(error);
  
  // Check for common CSS-in-JS errors
  if (
    errorString.includes('useInsertionEffect') || 
    errorString.includes('emotion') || 
    errorString.includes('styled-components') ||
    errorString.includes('createRoot') // React 18 root API
  ) {
    logWithTimestamp(`[StyleCompat] Detected CSS-in-JS library error: ${errorString}`, 'error');
    return true;
  }
  
  return false;
}

/**
 * A utility to safely use CSS-in-JS libraries in both React 17 and 18
 * This creates a component that wraps style providers with error handling
 */
export function createCompatStyleProvider(Provider: React.ComponentType<any>) {
  return function CompatStyleProvider(props: any) {
    try {
      return <Provider {...props} />;
    } catch (error) {
      logWithTimestamp(`[StyleCompat] Error in style provider: ${error}`, 'error');
      // Return children directly if the provider fails
      return props.children || null;
    }
  };
}
