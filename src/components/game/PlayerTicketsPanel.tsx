
import React, { useMemo } from "react";
import BingoTicketDisplay from "@/components/game/BingoTicketDisplay";
import { calculateTicketProgress } from "@/utils/ticketUtils";

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

  // Get the actual win pattern to use
  const effectiveWinPattern = currentWinPattern || (activeWinPatterns.length > 0 ? activeWinPatterns[0] : null);

  // Calculate win progress for each ticket and reorder them
  const sortedTickets = useMemo(() => {
    if (!autoMarking) return tickets;

    const ticketsWithProgress = tickets.map(ticket => {
      // Handle both layoutMask and layout_mask property naming
      const layoutMask = ticket.layoutMask || ticket.layout_mask;
      
      // Make sure layoutMask exists before processing
      if (!layoutMask) {
        console.warn("Ticket without layoutMask encountered:", ticket);
        return { ...ticket, minToGo: Infinity };
      }
      
      // Process ticket grid and get progress
      const grid = processTicketLayout(ticket.numbers, layoutMask);
      const progress = calculateTicketProgress(grid, calledNumbers, effectiveWinPattern || "oneLine");
      
      // Return ticket with additional progress info
      return {
        ...ticket,
        minToGo: progress.numbersToGo,
        isWinner: progress.isWinner,
        completedLines: progress.completedLines,
        linesToGo: progress.linesToGo
      };
    });

    // Sort tickets by how close they are to winning (lowest minToGo first, winners at top)
    return [...ticketsWithProgress].sort((a, b) => {
      // Winners come first
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      
      // Then sort by numbers to go
      return a.minToGo - b.minToGo;
    });
  }, [tickets, calledNumbers, autoMarking, effectiveWinPattern]);

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
              .map((ticket) => {
                // Handle both layoutMask and layout_mask property naming
                const layoutMask = ticket.layoutMask || ticket.layout_mask;
                
                return (
                  <div key={ticket.serial} className="border rounded-lg p-4">
                    <BingoTicketDisplay
                      numbers={ticket.numbers}
                      layoutMask={layoutMask}
                      calledNumbers={calledNumbers}
                      serial={ticket.serial}
                      perm={ticket.perm}
                      position={ticket.position}
                      autoMarking={autoMarking}
                      currentWinPattern={effectiveWinPattern}
                      showProgress={true}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Import utility at the top
import { processTicketLayout } from "@/utils/ticketUtils";
