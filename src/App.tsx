
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import Login from './pages/Login';
import RegisterSuperuser from './pages/RegisterSuperuser';
import Dashboard from './pages/Dashboard';
import PlayerJoin from './pages/PlayerJoin';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { SessionProvider } from './contexts/SessionProvider';

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
              <Route path="/admin/*" element={<Dashboard />} />
              <Route path="/caller/*" element={<Dashboard />} />
              <Route path="/player/join" element={<PlayerJoin />} />
              <Route path="*" element={<div>Not Found</div>} />
            </Routes>
          </Router>
        </SessionProvider>
      </AuthContextProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
