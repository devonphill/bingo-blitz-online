
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4 text-center">
      <h1 className="text-5xl font-bold text-bingo-primary mb-4 animate-fade-in">
        Bingo Blitz
      </h1>
      <p className="text-xl text-gray-600 max-w-md mb-8 animate-fade-in">
        A real-time online bingo platform for hosting and playing various bingo games
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
        <Button 
          className="bg-gradient-to-r from-bingo-primary to-bingo-secondary hover:from-bingo-secondary hover:to-bingo-tertiary text-lg px-6 py-6"
          onClick={() => navigate('/player/join')}
        >
          Join as Player
        </Button>
        
        <Button 
          variant="outline" 
          className="text-lg px-6 py-6 border-bingo-primary text-bingo-primary hover:bg-bingo-primary hover:text-white"
          onClick={() => navigate('/login')}
        >
          Login as Host
        </Button>
      </div>
      
      {role === "superuser" && (
        <Button 
          className="mt-6 text-lg px-6 py-6 bg-gradient-to-r from-bingo-secondary to-bingo-primary"
          onClick={() => navigate("/admin")}
        >
          Go to Admin Dashboard
        </Button>
      )}
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full animate-fade-in">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-bingo-tertiary mb-2">Multi-Game Support</div>
          <p className="text-gray-600">Play various bingo formats including 90-Ball, 80-Ball, Quiz, Music, and Logo bingo.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-bingo-tertiary mb-2">Real-time Experience</div>
          <p className="text-gray-600">Enjoy a seamless, real-time gaming experience with instant updates and notifications.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-bingo-tertiary mb-2">Easy Access</div>
          <p className="text-gray-600">Players can join games with simple 6-digit codes. No accounts needed for players.</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
