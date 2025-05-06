
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import LoginForm from "../components/auth/LoginForm";

const LoginPage = () => {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we have a user and we're not in a loading state
    if (!isLoading && user) {
      console.log("Login successful, redirecting to dashboard");
      navigate(role === "superuser" ? "/admin" : "/dashboard");
    }
  }, [user, isLoading, role, navigate]);

  console.log("Login page rendering. Auth loading:", isLoading, "User:", user ? "exists" : "null", "Role:", role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Spinner size="md" />
            <p className="mt-4 text-gray-600">Authenticating...</p>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
