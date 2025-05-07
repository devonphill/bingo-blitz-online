
import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useSessionContext } from "@/contexts/SessionProvider";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import SessionDebugPanel from "@/components/dashboard/SessionDebugPanel";
import CreateSessionForm from "@/components/dashboard/CreateSessionForm";
import { Button } from "@/components/ui/button";
import SessionCard from "@/components/dashboard/SessionCard";

const DashboardCreateSessionForm = ({ onClose }: { onClose: () => void }) => {
  return <CreateSessionForm />;
};

const DashboardPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { sessions, fetchSessions, isLoading: sessionsLoading } = useSessionContext();
  const [showCreateSessionForm, setShowCreateSessionForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      console.log("Dashboard: Not authenticated, redirecting to login");
      navigate("/login");
      return;
    }

    if (user && !authLoading && !sessionsLoading && !sessions?.length) {
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

      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Game Sessions</h2>
          <p className="text-gray-600">Manage your bingo game sessions</p>
        </div>
        <Button
          variant="default"
          onClick={() => setShowCreateSessionForm(true)}
        >
          Add Session
        </Button>
      </div>

      {showCreateSessionForm && (
        <div className="mb-6">
          <DashboardCreateSessionForm onClose={() => setShowCreateSessionForm(false)} />
        </div>
      )}

      {sessions && sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <p>No sessions found. Create your first session to get started.</p>
        </div>
      )}

      <SessionDebugPanel />
    </div>
  );
};

export default DashboardPage;
