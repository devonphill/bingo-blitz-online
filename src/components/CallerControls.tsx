
import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSessionContext } from '@/contexts/SessionProvider';
import { logWithTimestamp } from '@/utils/logUtils';
import { Button } from '@/components/ui/button';

const CallerControls = () => {
  const { signIn, isLoading, error } = useAuth();
  const { joinSession } = useSessionContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
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
      logWithTimestamp("Attempting to sign in with: " + email);
      setSubmitting(true);
      setFormSubmitted(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        throw error;
      }
      
      toast({ title: "Login successful", description: "Welcome back!" });
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err.message);
      toast({
        title: "Login failed",
        description: "Invalid credentials or server issue",
        variant: "destructive"
      });
      setSubmitting(false);
      setFormSubmitted(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await joinSession(sessionCode);
    if (result.success) {
      console.log('Joined session successfully');
    } else {
      console.error('Failed to join session:', result.error);
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
    <>
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
        <Button 
          type="submit" 
          className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400" 
          disabled={formSubmitted && isLoading}
        >
          {isLoading && formSubmitted ? "Logging in..." : "Login"}
        </Button>
      </form>
      <form onSubmit={handleJoinSession} className="mt-4">
        <input
          type="text"
          placeholder="Enter Session Code"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value)}
          className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          required
        />
        <Button type="submit" className="w-full">Join Session</Button>
      </form>
    </>
  );
};

export default CallerControls;
