
import React from "react";
import { SimpleTooltip } from "@/utils/reactCompatUtils";
import { cn } from "@/lib/utils";

const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => {
  return <div className={cn("inline-block", className)} {...props} ref={ref as any} />;
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }
>(({ className, sideOffset = 4, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    />
  );
});
TooltipContent.displayName = "TooltipContent";

// Create a simpler compatibility component for easy usage
const CompatTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ content, children, className }) => {
  return (
    <SimpleTooltip content={content} className={className}>
      {children}
    </SimpleTooltip>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, CompatTooltip };
