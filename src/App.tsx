
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CallerDashboard from './pages/CallerDashboard';
import PlayerDashboard from './pages/PlayerDashboard';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './contexts/AuthProvider';
import { SessionProvider } from './contexts/SessionProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bingo-ui-theme">
      <AuthProvider>
        <SessionProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/caller/*" element={<CallerDashboard />} />
              <Route path="/player/*" element={<PlayerDashboard />} />
              <Route path="*" element={<div>Not Found</div>} />
            </Routes>
          </Router>
        </SessionProvider>
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
