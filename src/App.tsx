
import { Suspense, lazy } from "react";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { NetworkProvider } from "./contexts/NetworkStatusContext"; // Import the NetworkProvider
import { Spinner } from "@/components/ui/spinner";

// Lazy load components to improve initial load time
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Layout = lazy(() => import("./components/Layout"));
const AdminRoute = lazy(() => import("./components/auth/AdminRoute"));
const PrivateRoute = lazy(() => import("./components/auth/PrivateRoute"));
const PublicRoute = lazy(() => import("./components/auth/PublicRoute"));
const CallerHome = lazy(() => import("./pages/CallerHome"));
const GameSetup = lazy(() => import("./pages/GameSetup"));
const GameManagement = lazy(() => import("./pages/GameManagement"));
const GameSession = lazy(() => import("./pages/GameSession"));
const PlayerJoin = lazy(() => import("./pages/PlayerJoin"));
const PlayerGame = lazy(() => import("./pages/PlayerGame"));

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <NetworkProvider> {/* Wrap the entire app in the NetworkProvider */}
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                </Route>
                
                {/* Public auth routes (accessible only when NOT logged in) */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Route>
                
                {/* Protected routes (require auth) */}
                <Route element={<PrivateRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                </Route>
                
                {/* Admin only routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/caller" element={<CallerHome />} />
                  <Route path="/caller/setup" element={<GameSetup />} />
                  <Route path="/caller/manage" element={<GameManagement />} />
                  <Route path="/caller/session/:sessionId" element={<GameSession />} />
                </Route>
                
                {/* Player routes (publicly accessible) */}
                <Route path="/player/join" element={<PlayerJoin />} />
                <Route path="/player/game/:playerCode?" element={<PlayerGame />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
        <Toaster />
      </NetworkProvider>
    </ThemeProvider>
  );
}

export default App;
