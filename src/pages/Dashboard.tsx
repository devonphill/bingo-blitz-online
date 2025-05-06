import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Spinner from "../components/ui/Spinner";

const DashboardPage = () => {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="md" />
        <p className="mt-4 text-gray-600">Loading user data...</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome to the Dashboard</h1>
      {/* Add your dashboard content here */}
    </div>
  );
};

export default DashboardPage;