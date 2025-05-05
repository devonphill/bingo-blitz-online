
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CreateSessionForm from '@/components/dashboard/CreateSessionForm';
import SessionCard from '@/components/dashboard/SessionCard';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { Menu } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { sessions, fetchSessions, isLoading: sessionsLoading } = useSessionContext();
  const navigate = useNavigate();
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const isLoading = authLoading || (sessionsLoading && !fetchAttempted);

  useEffect(() => {
    console.log("Dashboard render - Auth loading:", authLoading, "User:", user ? "logged in" : "not logged in");
    
    // If auth is not loading and user is not logged in, redirect to login
    if (!authLoading && !user) {
      console.log("No authenticated user found, redirecting to login");
      navigate('/login');
      return;
    }

    // Fetch sessions when the dashboard loads and user is authenticated
    if (user && !authLoading) {
      console.log("User is authenticated, fetching sessions");
      fetchSessions().then(() => {
        setFetchAttempted(true);
      });
      fetchTokenCount();
    }
  }, [user, authLoading, fetchSessions, navigate]);

  const fetchTokenCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('token_count')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setTokenCount(data?.token_count ?? 0);
    } catch (err) {
      console.error('Error fetching token count:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Show loading state while auth is being determined
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Loading user data...</p>
      </div>
    );
  }

  // If not loading and no user, we should be redirecting to login
  if (!user && !authLoading) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <DashboardSidebar />
        <div className="flex-1">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
                <h1 className="text-2xl font-bold text-bingo-primary">Bingo Blitz</h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm font-medium">
                  Credits: {tokenCount ?? '...'}
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </header>
          
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Game Sessions</h2>
                <p className="text-gray-600">Manage your bingo game sessions</p>
              </div>
              <CreateSessionForm />
            </div>
            
            {sessionsLoading ? (
              <div className="flex justify-center items-center h-48">
                <p className="text-gray-500">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Yet</h3>
                <p className="text-gray-500 mb-4">Create your first bingo session to get started</p>
                <CreateSessionForm />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
