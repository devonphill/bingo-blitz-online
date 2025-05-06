
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionContext } from "../contexts/SessionProvider";
import { Spinner } from "@/components/ui/spinner";
import SessionDebugPanel from "../components/dashboard/SessionDebugPanel";

const DashboardPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { sessions, fetchSessions, isLoading: sessionsLoading } = useSessionContext();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }

    // Load sessions as soon as authentication is confirmed
    if (user && !sessionsLoading && !sessions.length) {
      console.log("Dashboard: Loading sessions");
      fetchSessions();
    }
  }, [authLoading, user, navigate, fetchSessions, sessionsLoading, sessions]);

  // Show spinner while authentication is in progress
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="md" />
        <p className="ml-4 text-gray-600">Verifying authentication...</p>
      </div>
    );
  }

  // Show spinner while sessions are loading
  if (sessionsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="md" />
        <p className="ml-4 text-gray-600">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(session => (
            <div key={session.id} className="border p-4 rounded-md shadow-sm">
              <h2 className="text-lg font-semibold">{session.name}</h2>
              <p>Type: {session.gameType}</p>
              <p>Created: {new Date(session.createdAt).toLocaleDateString()}</p>
              <p>Code: {session.accessCode}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <p>No sessions found. Create your first session to get started.</p>
        </div>
      )}
      
      {/* Debug panel for development */}
      <SessionDebugPanel />
    </div>
  );
};

export default DashboardPage;
