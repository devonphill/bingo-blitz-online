
import React from 'react';

interface LogoBingoGameProps {
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
}

export default function LogoBingoGame({
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true
}: LogoBingoGameProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Logo Bingo</h2>
        <p className="text-sm text-gray-600">
          Your logo bingo cards will appear here
        </p>
      </div>
      
      {tickets && tickets.length > 0 ? (
        <div className="text-center py-8">
          <p>Logo Bingo implementation coming soon</p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No logo cards available for this game
        </div>
      )}
    </div>
  );
}
