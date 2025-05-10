
import React from 'react';

interface MusicBingoGameProps {
  tickets: any[];
  calledNumbers: number[];
  lastCalledNumber: number | null;
  autoMarking?: boolean;
}

export default function MusicBingoGame({
  tickets,
  calledNumbers,
  lastCalledNumber,
  autoMarking = true
}: MusicBingoGameProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Music Bingo</h2>
        <p className="text-sm text-gray-600">
          Your music bingo cards will appear here
        </p>
      </div>
      
      {tickets && tickets.length > 0 ? (
        <div className="text-center py-8">
          <p>Music Bingo implementation coming soon</p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No music cards available for this game
        </div>
      )}
    </div>
  );
}
