
import React from 'react';
import { logWithTimestamp } from './logUtils';
import { useCompatId } from './reactCompatUtils';

/**
 * A HOC (Higher Order Component) to wrap Radix UI components
 * and provide React 17 compatibility
 */
export function withReact17Compatibility<T extends React.ComponentType<any>>(
  Component: T,
  componentName: string
): T {
  const WrappedComponent = React.forwardRef((props: any, ref) => {
    try {
      return React.createElement(Component, { ...props, ref });
    } catch (error) {
      logWithTimestamp(`Error rendering ${componentName}: ${error}`, 'error');
      
      // Return a fallback component
      return React.createElement(
        'div',
        { 
          className: "bg-red-50 text-red-500 border border-red-200 rounded p-2 text-sm" 
        },
        `Unable to render ${componentName} component due to React version compatibility.`
      );
    }
  });
  
  WrappedComponent.displayName = `React17Compatible(${componentName})`;
  return WrappedComponent as unknown as T;
}

/**
 * A hook to generate a stable unique ID for a component instance
 * This is a wrapper around our compatibility useId hook
 */
export function useComponentId(prefix: string = 'comp-'): string {
  return useCompatId(prefix);
}

/**
 * Utility to safely wrap a child component with props
 * This helps avoid issues with cloning React elements
 */
export function safeCloneElement(
  element: React.ReactElement | React.ReactNode,
  props: Record<string, any>
): React.ReactElement {
  if (!React.isValidElement(element)) {
    return React.createElement(React.Fragment, null, element);
  }
  
  try {
    return React.cloneElement(element as React.ReactElement, props);
  } catch (error) {
    logWithTimestamp(`Error cloning element: ${error}`, 'error');
    return element as React.ReactElement;
  }
}
