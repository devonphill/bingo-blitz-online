
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CreateSessionForm from '@/components/dashboard/CreateSessionForm';
import SessionCard from '@/components/dashboard/SessionCard';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
// Add import for AddPlayerForm
import AddPlayerForm from '@/components/player/AddPlayerForm';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { sessions } = useSession();
  const navigate = useNavigate();

  // Add state for selecting a session for player addition
  const [selectedSessionId, setSelectedSessionId] = useState(
    sessions.length > 0 ? sessions[0].id : ''
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-bingo-primary">Bingo Blitz</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Welcome, <span className="font-semibold">{user?.email}</span>
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
            {/* Session selector and Add Player Form */}
            {sessions.length > 0 && (
              <div className="my-2 flex flex-col sm:flex-row items-center gap-2">
                <label htmlFor="player-session-select" className="text-sm font-medium mr-2">
                  Add Player To:
                </label>
                <select
                  id="player-session-select"
                  className="border rounded px-2 py-1 bg-white"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.name} ({session.accessCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {sessions.length > 0 && selectedSessionId && (
              <AddPlayerForm sessionId={selectedSessionId} />
            )}
          </div>
          <CreateSessionForm />
        </div>
        
        {sessions.length === 0 ? (
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
  );
}
