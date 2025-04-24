import React, { useEffect } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      if (role === "superuser") navigate("/admin");
      else navigate("/dashboard");
    }
  }, [user, isLoading, role, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-bingo-dark mb-2">Bingo Blitz</h1>
          <p className="text-gray-600">Real-time online bingo platform</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
