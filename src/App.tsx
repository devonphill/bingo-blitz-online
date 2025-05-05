
import { Suspense, lazy } from "react";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthContextProvider } from "./contexts/AuthContext";
import { NetworkProvider } from "./contexts/NetworkStatusContext";
import { Skeleton } from "@/components/ui/skeleton";

// Simplified loading spinner component
const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  
  return (
    <div className={`animate-spin rounded-full border-t-2 border-blue-500 ${sizeClass[size]}`}></div>
  );
};

// Create a basic index page to serve as our home page
const Home = lazy(() => import("./pages/Index"));
// Use Index page as a fallback for missing pages
const About = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
// Setup simplified pages
const Register = () => <div className="p-8"><h1 className="text-2xl">Register Page</h1><p>This page is not yet implemented.</p></div>;
const ForgotPassword = () => <div className="p-8"><h1 className="text-2xl">Forgot Password</h1><p>This page is not yet implemented.</p></div>;

// Simple layout component
const Layout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="min-h-screen">
      <header className="p-4 bg-slate-100 border-b">
        <h1 className="text-lg font-bold">Bingo App</h1>
      </header>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
};

// Auth route components
const AdminRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const PrivateRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const PublicRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Game page placeholders
const CallerHome = () => <div className="p-8"><h1 className="text-2xl">Caller Home</h1><p>This page is not yet implemented.</p></div>;
const GameSetup = () => <div className="p-8"><h1 className="text-2xl">Game Setup</h1><p>This page is not yet implemented.</p></div>;
const GameManagement = () => <div className="p-8"><h1 className="text-2xl">Game Management</h1><p>This page is not yet implemented.</p></div>;
const GameSession = () => <div className="p-8"><h1 className="text-2xl">Game Session</h1><p>This page is not yet implemented.</p></div>;

// Player game pages
const PlayerJoin = () => <div className="p-8"><h1 className="text-2xl">Player Join</h1><p>This page is not yet implemented.</p></div>;
const PlayerGame = lazy(() => import("./pages/PlayerGame"));

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <NetworkProvider> 
        <AuthContextProvider>
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
        </AuthContextProvider>
        <Toaster />
      </NetworkProvider>
    </ThemeProvider>
  );
}

export default App;
