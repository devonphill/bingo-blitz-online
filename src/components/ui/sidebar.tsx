
import * as React from "react";
import { useSafeId } from "@/utils/reactUtils";

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

export function SidebarProvider({ defaultOpen = true, children }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  // Use our polyfill instead of React.useId()
  const sidebarId = useSafeId("sidebar-");

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
export function Sidebar({ children }: { children: React.ReactNode }) {
  const { sidebarId, open } = useSidebar();
  
  return (
    <aside
      id={sidebarId}
      className={`border-r border-gray-200 bg-white min-w-64 ${open ? 'w-64' : 'w-0 hidden'}`}
      aria-hidden={!open}
    >
      {children}
    </aside>
  );
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
