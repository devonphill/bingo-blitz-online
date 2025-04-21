
import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  if (role !== "superuser") {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-white shadow rounded-lg w-full max-w-2xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4 text-bingo-primary">Admin Dashboard</h1>
        <div className="mb-6">
          <p>Welcome <span className="font-bold">{user?.email}</span> (Superuser)</p>
          <p className="mt-2 text-gray-600">Site owner/admin panel: manage users, manage the CMS, and caller profiles setup.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button
            className="bg-gradient-to-r from-bingo-secondary to-bingo-primary"
            onClick={() => navigate("/dashboard")}
          >
            Go to Sessions
          </Button>
          <Button variant="outline" onClick={() => { logout(); navigate("/login"); }}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
