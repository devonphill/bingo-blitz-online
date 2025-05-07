import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { usePlayers } from './usePlayers';
import { useGameManager } from '@/contexts/GameManager'; // Import GameManager
import { logWithTimestamp } from '@/utils/logUtils';
import { useSessionContext } from "@/contexts/SessionProvider";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import SessionDebugPanel from "@/components/dashboard/SessionDebugPanel";
import CreateSessionForm from "@/components/dashboard/CreateSessionForm";

const GameManagerContext = createContext();

export const GameManagerProvider = ({ children }) => {
  const [currentGameType, setCurrentGameType] = useState('mainstage');
  const switchGameType = (gameType) => {
    setCurrentGameType(gameType);
  };

  return (
    <GameManagerContext.Provider value={{ currentGameType, switchGameType }}>
      {children}
    </GameManagerContext.Provider>
  );
};

export const useGameManager = () => {
  const context = useContext(GameManagerContext);
  if (!context) {
    throw new Error('useGameManager must be used within a GameManagerProvider');
  }
  return context;
};

const generateSessionId = () => Math.random().toString(36).substr(2, 9);

export function SessionProvider({ children }) {
  const { currentGameType } = useGameManager(); // Access current game type from GameManager
  const [session, setSession] = useState({
    id: null,
    gameType: null,
    players: [],
    state: "setup", // setup, lobby, live, completed
    name: 'New Session',
    createdBy: 'admin',
    accessCode: '123456',
    status: 'active',
  });

  const contextValue = {
    session,
    setCurrentSession: () => {},
    getSessionByCode: () => null,
    fetchSessions: async () => false,
    updateSession: async () => false,
    isLoading: false,
    error: null,
    players: [],
    joinSession: async () => ({ success: false }),
    addPlayer: async () => null,
    bulkAddPlayers: async () => ({ success: false }),
    fetchPlayers: async () => {},
    assignTicketsToPlayer: async () => {},
    getPlayerAssignedTickets: async () => {},
    transitionToState: () => {},
    createSession,
  };

  const createSession = () => {
    setSession({
      id: generateSessionId(),
      gameType: currentGameType,
      players: [],
      state: 'setup',
      name: 'New Session',
      createdBy: 'admin',
      accessCode: '123456',
      status: 'active',
    });
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

const SessionContext = createContext();

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}

const CallerControls = () => {
  const { session } = useSessionContext();

  const handleVerifyClaim = (playerId) => {
    console.log(`Verifying claim for player ${playerId}`);
    // Logic to verify the player's ticket
  };

  return (
    <div>
      <h2>Caller Controls</h2>
      {session?.players.map((player) => (
        <div key={player.id}>
          <p>{player.name}</p>
          <button onClick={() => handleVerifyClaim(player.id)}>Verify Claim</button>
        </div>
      ))}
    </div>
  );
};

export default CallerControls;

const DashboardPage: React.FC = () => {
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

    if (user && !authLoading && !sessionsLoading && !sessions.length) {
      console.log("Dashboard: Loading sessions");
      fetchSessions();
    }
  }, [authLoading, user, navigate, fetchSessions, sessionsLoading, sessions]);

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) {
        console.error('Error fetching sessions:', error);
      } else {
        setSessions(data || []);
      }
      setIsLoading(false);
    };

    fetchSessions();
  }, []);

  const handleEditSession = (sessionId) => {
    navigate(`/sessions/edit/${sessionId}`); // Navigate to edit session page
  };

  const handlePlaySession = (sessionId) => {
    navigate(`/sessions/play/${sessionId}`); // Navigate to play session page
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId);

      if (error) {
        throw error;
      }

      console.log("Session deleted successfully");
      fetchSessions(); // Refresh the session list
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const handleStartGame = () => {
    console.log('Game started');
    transitionToState('live');
  };

  console.log("Dashboard rendering. Auth loading:", authLoading, "Sessions loading:", sessionsLoading, "User:", user ? "exists" : "null");

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
          variant="primary"
          onClick={() => setShowCreateSessionForm(true)} // Show the session creation form
        >
          Add Session
        </Button>
      </div>

      {showCreateSessionForm && (
        <div className="mb-6">
          <CreateSessionForm onClose={() => setShowCreateSessionForm(false)} />
        </div>
      )}

      {sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="border p-4 rounded-md shadow-sm">
              <h2 className="text-lg font-semibold">{session.name}</h2>
              <p>Type: {session.gameType}</p>
              <p>Created: {new Date(session.createdAt).toLocaleDateString()}</p>
              <p>Code: {session.accessCode}</p>
              <div className="mt-4 flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditSession(session.id)} // Edit session logic
                >
                  Edit Session
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePlaySession(session.id)} // Play session logic
                >
                  Play Session
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteSession(session.id)} // Delete session logic
                >
                  Delete Session
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <p>No sessions found. Create your first session to get started.</p>
        </div>
      )}

      {session && (
        <button onClick={handleStartGame}>Start Game</button>
      )}

      <SessionDebugPanel />
    </div>
  );
};

export default DashboardPage;