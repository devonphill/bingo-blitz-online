
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 p-4 text-center">
      <h1 className="text-5xl font-bold text-blue-600 mb-4">
        Bingo Blitz Online
      </h1>
      <p className="text-xl text-gray-600 max-w-md mb-8">
        A real-time online bingo platform for hosting and playing various bingo games
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Button 
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-lg px-6 py-6"
          onClick={() => navigate('/player/join')}
        >
          Join as Player
        </Button>
        
        <Button 
          variant="outline" 
          className="text-lg px-6 py-6 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
          onClick={() => navigate('/login')}
        >
          Login as Host
        </Button>
        
        <Button
          className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-lg px-6 py-6"
          onClick={() => navigate('/signup')}
        >
          Join Now
        </Button>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-purple-600 mb-2">Multi-Game Support</div>
          <p className="text-gray-600">Play various bingo formats including 90-Ball, 80-Ball, Quiz, Music, and Logo bingo.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-purple-600 mb-2">Real-time Experience</div>
          <p className="text-gray-600">Enjoy a seamless, real-time gaming experience with instant updates and notifications.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-xl font-bold text-purple-600 mb-2">Easy Access</div>
          <p className="text-gray-600">Players can join games with simple 6-digit codes. No accounts needed for players.</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
