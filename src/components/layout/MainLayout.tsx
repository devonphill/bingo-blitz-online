
import React, { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from '@/components/ui/sidebar';
import { logWithTimestamp } from '@/utils/logUtils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Default to false to start with sidebar closed
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  useEffect(() => {
    logWithTimestamp('MainLayout component mounted', 'debug', 'Layout');
    logWithTimestamp(`Sidebar initial state: ${sidebarOpen ? 'open' : 'closed'}`, 'debug', 'Layout');
    
    return () => {
      logWithTimestamp('MainLayout component unmounted', 'debug', 'Layout');
    };
  }, [sidebarOpen]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <Sidebar className="transition-all duration-300">
          <div className="p-4 border-b">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold">Bingo Blitz</h2>
              <p className="text-sm text-muted-foreground">Game Management</p>
            </div>
          </div>
          <SidebarContent>
            <DashboardSidebar />
          </SidebarContent>
        </Sidebar>
        
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 shadow-sm">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="h-8 w-8 p-0"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Bingo Blitz Online</h1>
            </div>
          </header>
          <main className="flex-1 p-4 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
