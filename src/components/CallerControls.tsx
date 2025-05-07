import React, { useState, useEffect } from "react"; } from 'react';om 'react';
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";xt();import { usePlayers } from './usePlayers';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';rt { useGameManager } from '@/contexts/GameManager'; // Import GameManager
import { useSessionContext } from '@/contexts/SessionProvider';  const [currentGameType, setCurrentGameType] = useState('mainstage');@/types';

const LoginForm = () => {logWithTimestamp } from '@/utils/logUtils';
  const { signIn, isLoading, error } = useAuth();
  const { joinSession } = useSessionContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);value={{ currentGameType, switchGameType }}>sion: GameSession | null;
  const [formSubmitted, setFormSubmitted] = useState(false);      {children}
  const [sessionCode, setSessionCode] = useState('');: string) => GameSession | null;
  const navigate = useNavigate();Promise<boolean>;ber}>Generate Number</button>
updateSession: (sessionId: string, updates: Partial<GameSession>) => Promise<boolean>;
  const handleSubmit = async (e: React.FormEvent) => {utton>
    e.preventDefault();seGameManager = () => {
    nagerContext);er[];
    if (!email || !password) {: string; playerId?: string; error?: string }>;
      toast({ ager must be used within a GameManagerProvider');dPlayer: (sessionId: string, player: TempPlayer) => Promise<string | null>;
        title: "Validation Error", dPlayers: (sessionId: string, newPlayers: AdminTempPlayer[]) => Promise<{ success: boolean; message?: string; count?: number; error?: string }>;
        description: "Please enter both email and password", ext;  fetchPlayers?: (sessionId: string) => Promise<void>;  assignTicketsToPlayer?: (playerId: string, sessionId: string, ticketCount: number) => Promise<any>;  getPlayerAssignedTickets?: (playerId: string, sessionId: string) => Promise<any>;  transitionToState: (newState: string) => void;  createSession: () => void;}const SessionContext = createContext<SessionContextType | undefined>(undefined);interface SessionProviderProps {  children: ReactNode;}export function SessionProvider({ children }: SessionProviderProps) {  const { currentGameType } = useGameManager(); // Access current game type from GameManager  const [session, setSession] = useState({    id: null,    gameType: null,};    players: [],    state: "setup", // setup, lobby, live, completed    name: 'New Session',    createdBy: 'admin',    accessCode: '123456',    status: 'active',  });  const createSession = () => {    setSession({      id: generateSessionId(),      gameType: currentGameType,      players: [],      state: 'setup',      name: 'New Session',      createdBy: 'admin',      accessCode: '123456',      status: 'active',    });  };  const contextValue: SessionContextType = {    session,    sessions: [],    currentSession: null,    setCurrentSession: () => {},    getSessionByCode: () => null,    fetchSessions: async () => false,    updateSession: async () => false,    isLoading: false,    error: null,    players: [],    joinSession: async () => ({ success: false }),    addPlayer: async () => null,    bulkAddPlayers: async () => ({ success: false }),    fetchPlayers: async () => {},    assignTicketsToPlayer: async () => {},    getPlayerAssignedTickets: async () => {},    transitionToState: () => {},    createSession,  };  return (    <SessionContext.Provider value={contextValue}>      {children}    </SessionContext.Provider>  );}export function useSessionContext(): SessionContextType {  const context = useContext(SessionContext);  if (context === undefined) {    throw new Error('useSessionContext must be used within a SessionProvider');  }  return context;}const generateSessionId = () => Math.random().toString(36).substr(2, 9);        variant: "destructive"       });      return;    }    try {      console.log("Attempting to sign in with:", email);      setSubmitting(true);      setFormSubmitted(true);      const { error } = await supabase.auth.signInWithPassword({ email, password });      if (error) {        throw error;      }      toast({ title: "Login successful", description: "Welcome back!" });      navigate("/dashboard"); // Redirect to dashboard after successful login    } catch (err) {      console.error("Login error:", err.message);      toast({        title: "Login failed",        description: "Invalid credentials or server issue",        variant: "destructive",      });      setSubmitting(false);      setFormSubmitted(false);    }  };  const handleJoinSession = async (e: React.FormEvent) => {    e.preventDefault();    const result = await joinSession(sessionCode);    if (result.success) {      console.log('Joined session successfully');    } else {      console.error('Failed to join session:', result.error);    }  };  useEffect(() => {    // Only show success message if we've completed loading and have no errors    if (submitting && !isLoading && !error) {      console.log("Login successful, showing toast");      toast({ title: "Login successful", description: "Welcome back!" });    } else if (error) {      console.log("Login failed, showing error toast:", error);      setSubmitting(false);      setFormSubmitted(false);      toast({         title: "Login failed",         description: error,         variant: "destructive"       });    }  }, [isLoading, error, submitting]);  return (    <>      <form onSubmit={handleSubmit} className="space-y-4">        <input          type="email"          placeholder="Email"          value={email}          onChange={(e) => setEmail(e.target.value)}          className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"          required          disabled={formSubmitted && isLoading}        />        <input          type="password"          placeholder="Password"          value={password}          onChange={(e) => setPassword(e.target.value)}          className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"          required          disabled={formSubmitted && isLoading}
        />
        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400" 
          disabled={formSubmitted && isLoading}
        >
          {isLoading && formSubmitted ? "Logging in..." : "Login"}
        </button>
      </form>
      <form onSubmit={handleJoinSession}>
        <input
          type="text"
          placeholder="Enter Session Code"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value)}
          required
        />
        <button type="submit">Join Session</button>
      </form>
    </>
  );
};

export default LoginForm;
