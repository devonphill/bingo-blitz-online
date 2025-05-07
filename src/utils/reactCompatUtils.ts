
import React, { useState, useEffect } from 'react';
import { logWithTimestamp } from './logUtils';

// Counter for generating unique IDs
let idCounter = 0;

/**
 * React 17 compatible useId hook
 * This is a fallback for components that expect React 18's useId
 */
export function useCompatId(prefix: string = 'id-'): string {
  const [id] = useState(() => {
    const generatedId = `${prefix}${idCounter++}`;
    return generatedId;
  });
  return id;
}

/**
 * React 18 insertionEffect hook polyfill
 * This uses useLayoutEffect (or useEffect as fallback) to simulate useInsertionEffect
 */
export function useCompatInsertionEffect(callback: () => void | (() => void), deps?: React.DependencyList): void {
  // Try to use useLayoutEffect as it's closer to useInsertionEffect behavior
  // Fall back to useEffect if useLayoutEffect is not available
  const useEffectFn = React.useLayoutEffect || React.useEffect;
  useEffectFn(callback, deps);
}

/**
 * Checks if we're running in a React 17 environment
 */
export function isReact17(): boolean {
  try {
    // @ts-ignore - Checking React version
    const reactGlobal = typeof React !== 'undefined' ? React : (window.React || null);
    return reactGlobal && !reactGlobal.useId;
  } catch (e) {
    return true; // Assume React 17 if we can't detect
  }
}

/**
 * Aggressively patches React for compatibility
 * This should be called at app initialization before any components render
 */
export function patchReactForCompatibility() {
  try {
    // @ts-ignore - We're intentionally patching the global React object
    if (typeof React !== 'undefined') {
      logWithTimestamp('[ReactCompat] Patching React global object for compatibility', 'info');
      
      // Patch useId if it doesn't exist (React 17)
      // @ts-ignore - Add our polyfill to global React
      if (!React.useId) {
        // @ts-ignore
        React.useId = useCompatId;
        logWithTimestamp('[ReactCompat] Successfully patched React.useId', 'info');
      }
      
      // Patch useInsertionEffect if it doesn't exist (React 17)
      // @ts-ignore - Add our polyfill to global React
      if (!React.useInsertionEffect) {
        // @ts-ignore
        React.useInsertionEffect = useCompatInsertionEffect;
        logWithTimestamp('[ReactCompat] Successfully patched React.useInsertionEffect', 'info');
      }
      
      return true;
    }
    return false;
  } catch (e) {
    logWithTimestamp(`[ReactCompat] Error patching React: ${e}`, 'error');
    return false;
  }
}

/**
 * Simple compatibility components for Radix UI
 */

// Basic tooltip component that doesn't rely on Radix
export function SimpleTooltip({ 
  children, 
  content,
  className,
  delayDuration = 700
}: { 
  children: React.ReactNode; 
  content: React.ReactNode;
  className?: string;
  delayDuration?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const showTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = window.setTimeout(() => {
      setIsVisible(true);
    }, delayDuration);
    setTimeoutId(id as unknown as number);
  };

  const hideTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  // Using React.createElement instead of JSX
  return React.createElement(
    'div',
    {
      className: "relative inline-flex",
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip,
      onFocus: showTooltip,
      onBlur: hideTooltip
    },
    children,
    isVisible && React.createElement(
      'div',
      { 
        className: `absolute z-50 px-2 py-1 text-sm bg-black text-white rounded shadow-md -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap ${className || ''}` 
      },
      content,
      React.createElement(
        'div',
        { 
          className: "absolute w-2 h-2 bg-black transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" 
        }
      )
    )
  );
}

// Basic popover component that doesn't rely on Radix
export function SimplePopover({ 
  trigger, 
  content,
  className = ''
}: { 
  trigger: React.ReactNode; 
  content: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const togglePopover = () => setIsOpen(!isOpen);
  const closePopover = () => setIsOpen(false);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover-content]') && 
          !target.closest('[data-popover-trigger]')) {
        closePopover();
      }
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // Using React.createElement instead of JSX
  return React.createElement(
    'div',
    { className: "relative inline-block" },
    React.createElement(
      'div',
      {
        onClick: togglePopover,
        'data-popover-trigger': '',
        className: "cursor-pointer"
      },
      trigger
    ),
    isOpen && React.createElement(
      'div',
      {
        'data-popover-content': '',
        className: `absolute z-50 mt-2 p-4 bg-white border rounded-md shadow-lg ${className}`,
        style: { minWidth: '200px' }
      },
      content
    )
  );
}

// Simple button component that replicates Radix Slot functionality
export function CompatButton({
  className = '',
  asChild = false,
  children,
  ...props
}: {
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
  [key: string]: any;
}) {
  // If asChild is true, clone the first child and pass the props
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: `${children.props.className || ''} ${className}`.trim()
    });
  }
  
  // Otherwise, render a regular button
  return React.createElement(
    'button',
    {
      className,
      ...props
    },
    children
  );
}
