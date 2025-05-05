
import React, { useEffect, useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";

export default function Login() {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [redirectTimer, setRedirectTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log("Login page: Auth state update", { 
      user: user ? "exists" : "null", 
      isLoading, 
      role 
    });
    
    // Clear any existing redirect timer
    if (redirectTimer) {
      clearTimeout(redirectTimer);
    }

    // Only redirect when we have a user, are not loading, and have a role
    if (!isLoading && user) {
      console.log("Login page: Preparing to redirect user with role:", role);
      
      // Set a slight delay to ensure consistent UI and complete state updates
      const timer = setTimeout(() => {
        if (role === "superuser") {
          console.log("Redirecting to admin dashboard");
          navigate("/admin");
        } else {
          console.log("Redirecting to user dashboard");
          navigate("/dashboard");
        }
      }, 500);
      
      setRedirectTimer(timer);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, role, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [redirectTimer]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-bingo-dark mb-2">Bingo Blitz</h1>
          <p className="text-gray-600">Real-time online bingo platform</p>
        </div>
        
        {isLoading && user ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Spinner size="md" />
            <p className="mt-4 text-gray-600">Redirecting to dashboard...</p>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
}
