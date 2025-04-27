
import { BrowserRouter as Router, Routes, Route, useEffect } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import RegisterSuperuser from "./pages/RegisterSuperuser";
import NotFound from "./pages/NotFound";
import PlayerJoin from "./pages/PlayerJoin";
import PlayerGame from "./pages/PlayerGame";
import AddPlayers from "./pages/AddPlayers";
import CallerSession from "./pages/CallerSession";
import AdminDashboard from "./pages/AdminDashboard";
import { Toaster } from './components/ui/toaster';
import { SessionProvider } from './contexts/SessionProvider';
import { AuthProvider } from './contexts/AuthContext';
import { createRequiredTables } from './utils/databaseCreator';

function AppInitializer() {
  useEffect(() => {
    // Initialize required database tables
    createRequiredTables()
      .then(() => console.log('Database tables initialized successfully'))
      .catch(err => console.error('Error initializing database tables:', err));
  }, []);
  
  return null;
}

function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <AppInitializer />
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/register/superuser" element={<RegisterSuperuser />} />
            <Route path="/player/join" element={<PlayerJoin />} />
            <Route path="/player/game" element={<PlayerGame />} />
            <Route path="/session/:sessionId" element={<CallerSession />} />
            <Route path="/session/:sessionId/players/add" element={<AddPlayers />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </Router>
      </SessionProvider>
    </AuthProvider>
  );
}

export default App;
