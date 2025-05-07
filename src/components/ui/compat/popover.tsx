
import React from "react";
import { SimplePopover } from "@/utils/reactCompatUtils";
import { cn } from "@/lib/utils";

const Popover: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const PopoverTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return <div className={cn("inline-block", className)} {...props} ref={ref} />;
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "center" | "start" | "end"; sideOffset?: number }
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  );
});
PopoverContent.displayName = "PopoverContent";

// Create a simpler compatibility component for easy usage
const CompatPopover: React.FC<{
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}> = ({ trigger, content, className }) => {
  return (
    <SimplePopover trigger={trigger} content={content} className={className} />
  );
};

export { Popover, PopoverTrigger, PopoverContent, CompatPopover };
