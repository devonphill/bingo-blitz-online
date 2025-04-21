
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

export default function RegisterSuperuser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [superuserExists, setSuperuserExists] = useState<boolean | null>(null);

  // Check if a superuser already exists (on mount)
  React.useEffect(() => {
    async function checkSuperuser() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "superuser")
        .limit(1);
      setSuperuserExists(data && data.length > 0);
    }
    checkSuperuser();
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    // 1. Register with Supabase Auth
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      setCreating(false);
      setError(signupError.message);
      return;
    }

    // 2. Set role to "superuser" in profiles
    const supaUser = data.user;
    if (supaUser) {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ role: "superuser" })
        .eq("id", supaUser.id);
      if (updateProfileError) {
        setCreating(false);
        setError("User created, but failed to promote to superuser. Use the dashboard admin to update role.");
        return;
      }
    }

    toast({ title: "Superuser created!", description: "You can now log in as Superuser." });
    setCreating(false);
    navigate("/login");
  }

  if (superuserExists === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  if (superuserExists) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-2 text-red-600">Superuser Already Exists</h1>
          <p className="mb-4 text-gray-600">A superuser has already been registered. This page can be safely removed for security.</p>
          <Button onClick={() => navigate("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <form
        onSubmit={handleRegister}
        className="bg-white rounded-lg shadow p-8 w-full max-w-md space-y-6"
      >
        <h1 className="text-2xl font-bold mb-2 text-bingo-primary">
          Register Superuser
        </h1>
        <p className="text-gray-600">
          Create a Superuser account for the site. This page can be deleted afterward.
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={creating}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={creating}
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <Button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create Superuser"}
        </Button>
      </form>
    </div>
  );
}
