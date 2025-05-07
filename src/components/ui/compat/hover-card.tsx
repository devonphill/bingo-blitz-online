
import React from 'react';
import { SimpleTooltip } from '@/utils/reactCompatUtils';

// This is a simplified version of the HoverCard component
// that falls back to a tooltip for React 17 compatibility
export function CompatHoverCard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function CompatHoverCardTrigger({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
  return <div {...props}>{children}</div>;
}

export function CompatHoverCardContent({ 
  children, 
  className 
}: { 
  children: React.ReactNode,
  className?: string
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

// Re-export for API compatibility with Radix
export const HoverCard = CompatHoverCard;
export const HoverCardTrigger = CompatHoverCardTrigger;
export const HoverCardContent = CompatHoverCardContent;
