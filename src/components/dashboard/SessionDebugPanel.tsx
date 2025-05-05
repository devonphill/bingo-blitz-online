
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionContext } from '@/contexts/SessionProvider';
import { Button } from '@/components/ui/button';

export default function SessionDebugPanel() {
  const { user, session } = useAuth();
  const { sessions, fetchSessions, isLoading } = useSessionContext();

  const handleRefreshSessions = () => {
    fetchSessions();
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="bg-slate-100 border p-4 rounded-md my-4 text-sm">
      <h3 className="font-bold mb-2">Debug Panel</h3>
      <div className="space-y-2">
        <p><strong>Auth State:</strong> {user ? 'Authenticated' : 'Not Authenticated'}</p>
        {user && (
          <>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>User Email:</strong> {user.email}</p>
          </>
        )}
        <p><strong>Sessions Count:</strong> {sessions.length}</p>
        <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshSessions}
            disabled={isLoading}
          >
            Refresh Sessions
          </Button>
        </div>
      </div>
    </div>
  );
}
