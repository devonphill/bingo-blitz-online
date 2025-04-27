
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Login from './pages/Login';
import RegisterSuperuser from './pages/RegisterSuperuser';
import Dashboard from './pages/Dashboard';
import PlayerJoin from './pages/PlayerJoin';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { SessionProvider } from './contexts/SessionProvider';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bingo-ui-theme">
      <AuthContextProvider>
        <SessionProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<RegisterSuperuser />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/*" element={<AdminDashboard />} />
              <Route path="/caller/*" element={<Dashboard />} />
              <Route path="/player/join" element={<PlayerJoin />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </SessionProvider>
      </AuthContextProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
