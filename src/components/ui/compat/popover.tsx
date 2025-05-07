import React from 'react';
import { SimplePopover } from '@/utils/reactCompatUtils';

// This is a simplified version of the Popover component
// that doesn't rely on Radix UI for React 17 compatibility
export function CompatPopover({ children }: { children: React.ReactNode }) {
  // We use a context to pass the state down to children
  const [content, setContent] = React.useState<React.ReactNode | null>(null);
  const [trigger, setTrigger] = React.useState<React.ReactNode | null>(null);

  // Provide context so children can register themselves
  const contextValue = React.useMemo(() => ({ 
    registerTrigger: (node: React.ReactNode) => setTrigger(node),
    registerContent: (node: React.ReactNode) => setContent(node)
  }), []);

  // Render the SimplePopover if we have both trigger and content
  if (trigger && content) {
    return <SimplePopover trigger={trigger} content={content} />;
  }
  
  // Otherwise render the children directly with the context
  return (
    <PopoverContext.Provider value={contextValue}>
      {children}
    </PopoverContext.Provider>
  );
}

// Create a context for the popover components
const PopoverContext = React.createContext<{
  registerTrigger: (node: React.ReactNode) => void;
  registerContent: (node: React.ReactNode) => void;
}>({
  registerTrigger: () => {},
  registerContent: () => {}
});

export function CompatPopoverTrigger({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
  const { registerTrigger } = React.useContext(PopoverContext);
  
  // Register ourselves as the trigger
  React.useEffect(() => {
    registerTrigger(<div {...props}>{children}</div>);
    // We intentionally only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Render the children directly
  return <>{children}</>;
}

export function CompatPopoverContent({ 
  children, 
  className 
}: { 
  children: React.ReactNode,
  className?: string
}) {
  const { registerContent } = React.useContext(PopoverContext);
  
  // Register ourselves as the content
  React.useEffect(() => {
    registerContent(
      <div className={className}>
        {children}
      </div>
    );
    // We intentionally only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Don't render anything directly
  return null;
}

// Re-export for API compatibility with Radix
export const Popover = CompatPopover;
export const PopoverTrigger = CompatPopoverTrigger;
export const PopoverContent = CompatPopoverContent;
