
import React, { useMemo } from "react";
import BingoCard from "@/components/game/BingoCard";
import BingoWinProgress from "@/components/game/BingoWinProgress";

interface PlayerTicketsPanelProps {
  tickets: any[];
  calledNumbers: number[];
  autoMarking: boolean;
  activeWinPatterns: string[];
  currentWinPattern?: string | null;
}

export default function PlayerTicketsPanel({ 
  tickets, 
  calledNumbers, 
  autoMarking, 
  activeWinPatterns,
  currentWinPattern
}: PlayerTicketsPanelProps) {
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

  // Calculate win progress for each ticket and reorder them
  const sortedTickets = useMemo(() => {
    if (!autoMarking) return tickets;

    const ticketsWithProgress = tickets.map(ticket => {
      // Make sure ticket.layoutMask exists before trying to use toString()
      if (!ticket.layoutMask) {
        console.warn("Ticket without layoutMask encountered:", ticket);
        return { ...ticket, minToGo: Infinity };
      }
      
      // Calculate ticket progress using the same logic from BingoWinProgress
      const maskBits = ticket.layoutMask.toString(2).padStart(27, "0").split("").reverse();
      const rows: (number | null)[][] = [[], [], []];
      let nIdx = 0;

      for (let i = 0; i < 27; i++) {
        const row = Math.floor(i / 9);
        if (maskBits[i] === '1') {
          rows[row].push(ticket.numbers[nIdx]);
          nIdx++;
        } else {
          rows[row].push(null);
        }
      }

      const lineCounts = rows.map(line => line.filter(num => num !== null && calledNumbers.includes(num as number)).length);
      const lineNeeded = rows.map(line => line.filter(num => num !== null).length);
      const completedLines = lineCounts.filter((count, idx) => count === lineNeeded[idx]).length;

      // If there's a current win pattern, prioritize scoring based on it
      const patternsToCheck = currentWinPattern ? [currentWinPattern] : activeWinPatterns;
      const result: { [pattern: string]: number } = {};
      
      patternsToCheck.forEach(pattern => {
        let lines = 0;
        if (pattern === "oneLine") lines = 1;
        if (pattern === "twoLines") lines = 2;
        if (pattern === "fullHouse") lines = 3;
        
        const linesToGo = Math.max(0, lines - completedLines);
        let minNeeded = Infinity;
        if (linesToGo === 0) {
          minNeeded = 0;
        } else {
          minNeeded = Math.min(
            ...rows
              .map((line, idx) => lineNeeded[idx] - lineCounts[idx])
              .filter(n => n > 0)
          );
          if (minNeeded === Infinity) minNeeded = 0;
        }
        result[pattern] = minNeeded;
      });

      // Get the minimum number needed for the current win pattern or any active pattern
      const minToGo = currentWinPattern && result[currentWinPattern] !== undefined
        ? result[currentWinPattern]
        : Math.min(...patternsToCheck.map(p => result[p] ?? 15));
      
      return {
        ...ticket,
        minToGo
      };
    });

    // Sort tickets by how close they are to winning (lowest minToGo first)
    return [...ticketsWithProgress].sort((a, b) => a.minToGo - b.minToGo);
  }, [tickets, calledNumbers, autoMarking, activeWinPatterns, currentWinPattern]);

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bingo Tickets ({tickets.length})</h2>
      {Array.from(new Set(sortedTickets.map(t => t.perm))).map(perm => (
        <div key={`perm-${perm}`} className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Strip #{perm}</h3>
          <div className="grid grid-cols-1 gap-6">
            {sortedTickets
              .filter(t => t.perm === perm)
              .sort((a, b) => autoMarking ? a.minToGo - b.minToGo : a.position - b.position)
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
                  {ticket.layoutMask ? (
                    <>
                      <BingoCard
                        numbers={ticket.numbers}
                        layoutMask={ticket.layoutMask}
                        calledNumbers={calledNumbers}
                        autoMarking={autoMarking}
                        activeWinPatterns={activeWinPatterns}
                      />
                      <div className="text-center mt-4">
                        <BingoWinProgress
                          numbers={ticket.numbers}
                          layoutMask={ticket.layoutMask}
                          calledNumbers={calledNumbers}
                          activeWinPatterns={activeWinPatterns}
                          currentWinPattern={currentWinPattern}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      Ticket information is incomplete
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
