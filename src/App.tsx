
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SessionProvider } from "@/contexts/SessionContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import PlayerJoin from "./pages/PlayerJoin";
import Dashboard from "./pages/Dashboard";
import CallerSession from "./pages/CallerSession";
import PlayerGame from "./pages/PlayerGame";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import RegisterSuperuser from "./pages/RegisterSuperuser";
import AddPlayers from "./pages/AddPlayers";

const queryClient = new QueryClient();

// Protected route for authenticated users
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Protected routes logic updated for admin
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, role } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "superuser") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SessionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/join" element={<PlayerJoin />} />
              <Route path="/player/game" element={<PlayerGame />} />
              <Route path="/player/game/:playerCode" element={<PlayerGame />} />
              <Route path="/register-superuser" element={<RegisterSuperuser />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/caller/session/:sessionId" element={
                <ProtectedRoute>
                  <CallerSession />
                </ProtectedRoute>
              } />
              <Route path="/add-players/:sessionId" element={
                <ProtectedRoute>
                  <AddPlayers />
                </ProtectedRoute>
              } />
              
              {/* Admin routes */}
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
