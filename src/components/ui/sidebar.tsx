import * as React from "react";
import { useSafeId } from "@/utils/reactUtils";
import { logWithTimestamp } from "@/utils/logUtils";

interface SidebarProviderProps {
  defaultOpen?: boolean;
  children: React.ReactNode;
}

interface SidebarContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarId: string;
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ defaultOpen = false, children }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  // Use our polyfill instead of React.useId()
  const sidebarId = useSafeId("sidebar-");
  
  // Log when the sidebar state changes
  React.useEffect(() => {
    logWithTimestamp(`Sidebar state changed: ${open ? 'open' : 'closed'}`, 'debug', 'Sidebar');
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, sidebarId }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

// Sidebar component
export function Sidebar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { sidebarId, open } = useSidebar();
  
  // Log sidebar rendering with open state
  React.useEffect(() => {
    logWithTimestamp(`Sidebar rendered with open=${open}`, 'debug', 'Sidebar');
  }, [open]);
  
  return (
    <aside
      id={sidebarId}
      className={`border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${open ? 'min-w-64 w-64' : 'w-0 overflow-hidden'} ${className}`}
      aria-hidden={!open}
    >
      {children}
    </aside>
  );
}

// SidebarHeader component
export function SidebarHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b">{children}</div>;
}

// SidebarTrigger component
export function SidebarTrigger({ children }: { children?: React.ReactNode }) {
  const { setOpen, open } = useSidebar();
  
  const toggleSidebar = React.useCallback(() => {
    setOpen(prev => {
      const newState = !prev;
      logWithTimestamp(`Sidebar toggle clicked, new state: ${newState ? 'open' : 'closed'}`, 'debug', 'Sidebar');
      return newState;
    });
  }, [setOpen]);
  
  return (
    <button 
      onClick={toggleSidebar}
      className="p-2 rounded-md hover:bg-gray-100"
      aria-label={open ? "Close sidebar" : "Open sidebar"}
    >
      {children || (
        <span className="sr-only">Toggle sidebar</span>
      )}
    </button>
  );
}

// SidebarInset component
export function SidebarInset({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex-1 ${className}`}>{children}</div>;
}

// SidebarContent component
export function SidebarContent({ children }: { children: React.ReactNode }) {
  return <div className="py-4">{children}</div>;
}

// SidebarGroup component
export function SidebarGroup({ children }: { children: React.ReactNode }) {
  return <div className="mb-6">{children}</div>;
}

// SidebarGroupLabel component
export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="px-4 mb-2 text-sm font-semibold text-gray-600">{children}</h3>;
}

// SidebarGroupContent component
export function SidebarGroupContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 ${className}`}>{children}</div>;
}

// SidebarMenu component
export function SidebarMenu({ children }: { children: React.ReactNode }) {
  return <nav className="space-y-1">{children}</nav>;
}

// SidebarMenuItem component
export function SidebarMenuItem({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// SidebarMenuButton component
export function SidebarMenuButton({ 
  children, 
  onClick,
  asChild
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  asChild?: boolean;
}) {
  const Component = asChild ? React.Fragment : 'button';
  const props = asChild ? {} : {
    className: "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm text-left hover:bg-gray-100",
    onClick
  };
  
  return <Component {...props}>{children}</Component>;
}

// SidebarFooter component
export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto border-t p-4">{children}</div>;
}
