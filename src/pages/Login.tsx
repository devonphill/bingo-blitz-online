import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Spinner from "../components/ui/Spinner";
import LoginForm from "../components/auth/LoginForm";

const LoginPage = () => {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(role === "superuser" ? "/admin" : "/dashboard");
    }
  }, [user, isLoading, role, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <Spinner size="md" />
          <p className="mt-4 text-gray-600">Authenticating...</p>
        </div>
      ) : (
        <LoginForm />
      )}
    </div>
  );
};

export default LoginPage;