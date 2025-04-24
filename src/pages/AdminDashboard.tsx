import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { useNavigate } from "react-router-dom";
import BulkAddPlayersForm from "@/components/player/BulkAddPlayersForm";
import { GameRulesManager } from "@/components/admin/GameRulesManager";

export default function AdminDashboard() {
  const { user, role, logout } = useAuth();
  const { sessions } = useSession();
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState(
    sessions.length > 0 ? sessions[0].id : ''
  );

  if (role !== "superuser") {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg mb-8 p-8">
          <h1 className="text-3xl font-bold mb-4 text-bingo-primary">Admin Dashboard</h1>
          <div className="mb-6">
            <p>Welcome <span className="font-bold">{user?.email}</span> (Superuser)</p>
            <p className="mt-2 text-gray-600">Site owner/admin panel: manage users, game rules, and caller profiles.</p>
          </div>

          {/* Game Rules Management Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Game Rules Management</h2>
            <GameRulesManager />
          </div>

          {/* Bulk Add Players Section */}
          {sessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Bulk Add Players</h2>
              <div className="mb-6">
                <p>Select a session to add players:</p>
                <select
                  id="admin-session-select"
                  className="border rounded px-2 py-1 bg-white"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.name} ({session.accessCode})
                    </option>
                  ))}
                </select>
              </div>
              {selectedSessionId && (
                <BulkAddPlayersForm sessionId={selectedSessionId} />
              )}
            </div>
          )}

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
    </div>
  );
}
