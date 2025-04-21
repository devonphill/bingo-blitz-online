
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface GameHeaderProps {
  sessionName: string;
  accessCode: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({ sessionName, accessCode }) => {
  const navigate = useNavigate();
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-bingo-primary">Bingo Blitz</h1>
          <div className="text-sm text-gray-500">Session: {sessionName}</div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
            Access Code: <span className="font-mono font-bold">{accessCode}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
