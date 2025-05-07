import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const LoginForm = () => {
  const { signIn, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ 
        title: "Validation Error", 
        description: "Please enter both email and password", 
        variant: "destructive" 
      });
      return;
    }

    try {
      console.log("Attempting to sign in with:", email);
      setSubmitting(true);
      setFormSubmitted(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      toast({ title: "Login successful", description: "Welcome back!" });
      navigate("/dashboard"); // Redirect to dashboard after successful login
    } catch (err) {
      console.error("Login error:", err.message);
      toast({
        title: "Login failed",
        description: "Invalid credentials or server issue",
        variant: "destructive",
      });
      setSubmitting(false);
      setFormSubmitted(false);
    }
  };

  useEffect(() => {
    // Only show success message if we've completed loading and have no errors
    if (submitting && !isLoading && !error) {
      console.log("Login successful, showing toast");
      toast({ title: "Login successful", description: "Welcome back!" });
    } else if (error) {
      console.log("Login failed, showing error toast:", error);
      setSubmitting(false);
      setFormSubmitted(false);
      toast({ 
        title: "Login failed", 
        description: error, 
        variant: "destructive" 
      });
    }
  }, [isLoading, error, submitting]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
        disabled={formSubmitted && isLoading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
        disabled={formSubmitted && isLoading}
      />
      <button 
        type="submit" 
        className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400" 
        disabled={formSubmitted && isLoading}
      >
        {isLoading && formSubmitted ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
