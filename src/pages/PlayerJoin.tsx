
import React from 'react';
import PlayerJoinForm from '@/components/player/PlayerJoinForm';

export default function PlayerJoin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bingo-primary/10 to-bingo-secondary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-bingo-dark mb-2">Bingo Blitz</h1>
          <p className="text-gray-600">Join a game session</p>
        </div>
        <PlayerJoinForm />
      </div>
    </div>
  );
}
