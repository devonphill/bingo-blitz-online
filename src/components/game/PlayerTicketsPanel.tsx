
import React from "react";
import BingoCard from "@/components/game/BingoCard";
import BingoWinProgress from "@/components/game/BingoWinProgress";

interface PlayerTicketsPanelProps {
  tickets: any[];
  calledNumbers: number[];
  autoMarking: boolean;
  activeWinPatterns: string[];
}

export default function PlayerTicketsPanel({ tickets, calledNumbers, autoMarking, activeWinPatterns }: PlayerTicketsPanelProps) {
  if (!tickets || tickets.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">No Tickets Assigned</h2>
        </div>
        <p className="text-gray-600">You don't have any tickets assigned yet. Please wait for the game organizer to assign tickets.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bingo Tickets ({tickets.length})</h2>
      {Array.from(new Set(tickets.map(t => t.perm))).map(perm => (
        <div key={`perm-${perm}`} className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Strip #{perm}</h3>
          <div className="grid grid-cols-1 gap-6">
            {tickets
              .filter(t => t.perm === perm)
              .sort((a, b) => a.position - b.position)
              .map((ticket) => (
                <div key={ticket.serial} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium">
                      Perm: <span className="font-mono">{ticket.perm}</span>
                    </div>
                    <div className="text-sm font-medium">
                      Position: <span className="font-mono">{ticket.position}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-4">
                    Serial: <span className="font-mono">{ticket.serial}</span>
                  </div>
                  <BingoCard
                    numbers={ticket.numbers}
                    layoutMask={ticket.layoutMask}
                    calledNumbers={calledNumbers}
                    autoMarking={autoMarking}
                  />
                  <div className="text-center mt-4">
                    <BingoWinProgress
                      numbers={ticket.numbers}
                      layoutMask={ticket.layoutMask}
                      calledNumbers={calledNumbers}
                      activeWinPatterns={activeWinPatterns}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
