
import React, { useEffect, useState } from 'react';
import { Menu, Coins, Home, Users, FileText, Settings, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useNavigate, Link } from 'react-router-dom';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);

  useEffect(() => {
    logWithTimestamp('MainLayout component mounted', 'debug', 'Layout');
    
    const fetchTokens = async () => {
      if (!user?.id) return;
      
      setIsLoadingTokens(true);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('token_count')
          .eq('id', user.id)
          .single();
        
        if (error) {
          throw error;
        }
        
        setTokenCount(data.token_count || 0);
      } catch (error) {
        console.error('Error fetching token count:', error);
      } finally {
        setIsLoadingTokens(false);
      }
    };
    
    fetchTokens();
    
    return () => {
      logWithTimestamp('MainLayout component unmounted', 'debug', 'Layout');
    };
  }, [user?.id]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gray-50">
        <Sidebar className="transition-all duration-300 border-r shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 relative">
                <AspectRatio ratio={1/1} className="w-full h-full">
                  <img 
                    src="/lovable-uploads/a62a2374-863f-466e-8812-847aef0be5fa.png"
                    alt="Multi-Bingo Logo" 
                    className="h-full w-full object-contain"
                  />
                </AspectRatio>
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold">Multi-Bingo</h2>
                <p className="text-xs text-muted-foreground">Game Management</p>
              </div>
            </div>
          </div>
          <SidebarContent>
            <DashboardSidebar />
          </SidebarContent>
        </Sidebar>
        
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 shadow-sm">
            <SidebarTrigger>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Toggle sidebar">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
            
            <div className="flex-1 flex items-center">
              <Button 
                variant="ghost" 
                className="mr-2 flex items-center gap-2 text-base font-medium" 
                onClick={() => navigate('/')}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Button>
              
              <div className="h-4 w-px bg-gray-300 mx-2"></div>
              
              <h1 className="text-xl font-semibold">Multi-Bingo Platform</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <div 
                  className="flex items-center space-x-1 bg-gradient-to-r from-amber-50 to-amber-100 p-2 rounded-md cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/add-tokens')}
                  title="Add more credits"
                >
                  <Coins className="h-4 w-4 text-amber-500" />
                  {isLoadingTokens ? (
                    <Spinner size="sm" />
                  ) : (
                    <span className="font-medium text-amber-700">{tokenCount || 0}</span>
                  )}
                </div>
              )}
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
