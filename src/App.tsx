
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthContextProvider } from "./contexts/AuthContext";
import { NetworkProvider } from "@/contexts/NetworkStatusContext";
import { Spinner } from "@/components/ui/spinner";
import { SessionProvider } from "./contexts/SessionProvider";
import { GameManagerProvider } from "@/contexts/GameManager";
import MainLayout from '@/components/layout/MainLayout';
import LoginForm from '@/components/auth/LoginForm';

// Simplified loading spinner component
const LoadingSpinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size={size} />
    </div>
  );
};

// Create a basic index page to serve as our home page
const Home = lazy(() => import("./pages/Index"));
const About = lazy(() => import("./pages/Index"));
const CallerSession = lazy(() => import("./pages/CallerSession"));
const PlayerJoin = lazy(() => import("./pages/PlayerJoin"));
const PlayerGame = lazy(() => import("./pages/PlayerGame"));
const AddPlayers = lazy(() => import("./pages/AddPlayers"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

// Setup simplified pages
const Register = () => <div className="p-8"><h1 className="text-2xl">Register Page</h1><p>This page is not yet implemented.</p></div>;
const ForgotPassword = () => <div className="p-8"><h1 className="text-2xl">Forgot Password</h1><p>This page is not yet implemented.</p></div>;

// Simple layout component
const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="max-w-screen-xl mx-auto p-4">{children}</div>;
};

// Auth route components with proper children props
const AdminRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const PrivateRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const PublicRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Game page placeholders
const CallerHome = () => <div className="p-8"><h1 className="text-2xl">Caller Home</h1><p>This page is not yet implemented.</p></div>;
const GameSetup = () => <div className="p-8"><h1 className="text-2xl">Game Setup</h1><p>This page is not yet implemented.</p></div>;
const GameManagement = () => <div className="p-8"><h1 className="text-2xl">Game Management</h1><p>This page is not yet implemented.</p></div>;

// Update the App component to include the NetworkProvider if it's not already there
function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bingo-theme">
      <AuthContextProvider>
        <NetworkProvider>
          <GameManagerProvider>
            <SessionProvider>
              <Router>
                <Suspense fallback={<LoadingSpinner size="lg" />}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
                    <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
                    
                    {/* Public auth routes (accessible only when NOT logged in) */}
                    <Route path="/login" element={<PublicRoute><PublicLayout><LoginForm /></PublicLayout></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><PublicLayout><Register /></PublicLayout></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><PublicLayout><ForgotPassword /></PublicLayout></PublicRoute>} />
                    
                    {/* Protected routes (require auth) */}
                    <Route path="/dashboard" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
                    
                    {/* Admin only routes */}
                    <Route path="/caller" element={<AdminRoute><MainLayout><CallerHome /></MainLayout></AdminRoute>} />
                    <Route path="/caller/setup" element={<AdminRoute><MainLayout><GameSetup /></MainLayout></AdminRoute>} />
                    <Route path="/caller/manage" element={<AdminRoute><MainLayout><GameManagement /></MainLayout></AdminRoute>} />
                    <Route path="/caller/session/:sessionId" element={<AdminRoute><MainLayout><CallerSession /></MainLayout></AdminRoute>} />
                    
                    {/* Players management */}
                    <Route path="/session/:sessionId/players/add" element={<PrivateRoute><MainLayout><AddPlayers /></MainLayout></PrivateRoute>} />
                    
                    {/* Player routes (publicly accessible) */}
                    <Route path="/player/join" element={<PlayerJoin />} />
                    <Route path="/player/game/:playerCode?" element={<PlayerGame />} />
                  </Routes>
                </Suspense>
              </Router>
            </SessionProvider>
          </GameManagerProvider>
        </NetworkProvider>
      </AuthContextProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
