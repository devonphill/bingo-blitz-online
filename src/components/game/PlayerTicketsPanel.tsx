
import React, { useMemo, useState, useEffect } from "react";
import BingoTicketDisplay from "@/components/game/BingoTicketDisplay";
import { calculateTicketProgress, processTicketLayout } from "@/utils/ticketUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { logWithTimestamp } from "@/utils/logUtils";

interface PlayerTicketsPanelProps {
  tickets: any[];
  calledNumbers: number[];
  autoMarking: boolean;
  activeWinPatterns: string[];
  currentWinPattern?: string | null;
  sessionId?: string;
  onRefreshTickets?: () => void;
}

export default function PlayerTicketsPanel({ 
  tickets, 
  calledNumbers, 
  autoMarking, 
  activeWinPatterns,
  currentWinPattern,
  sessionId,
  onRefreshTickets
}: PlayerTicketsPanelProps) {
  const [showGameLobby, setShowGameLobby] = useState(false);

  // Determine if we should show the game lobby
  useEffect(() => {
    // If we have no tickets but we have a valid session
    if ((!tickets || tickets.length === 0) && sessionId) {
      logWithTimestamp('PlayerTicketsPanel: No tickets but session active, showing game lobby');
      setShowGameLobby(true);
    } else {
      setShowGameLobby(false);
    }
  }, [tickets, sessionId]);
  
  console.log(`Rendering PlayerTicketsPanel with ${tickets?.length || 0} tickets`);
  
  // Debug ticket data in more detail
  if (tickets && tickets.length > 0) {
    console.log('First ticket details:', {
      serial: tickets[0].serial || 'Unknown',
      perm: tickets[0].perm || 'Unknown',
      position: tickets[0].position || 'Unknown',
      layoutMask: tickets[0].layoutMask || tickets[0].layout_mask,
      numbersLength: tickets[0].numbers?.length || 0,
      firstFewNumbers: tickets[0].numbers?.slice(0, 5)
    });
  }
  
  // Show game lobby if requested
  if (showGameLobby) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Game Lobby</h2>
        </div>
        <p className="text-gray-600 mb-4">
          Waiting for the game organizer to assign tickets. The game will start soon.
        </p>
        {onRefreshTickets && (
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={onRefreshTickets}
          >
            <RefreshCw className="h-4 w-4" />
            Check for Tickets
          </Button>
        )}
      </div>
    );
  }
  
  // No tickets state - different from game lobby
  if (!tickets || tickets.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">No Tickets Assigned</h2>
        </div>
        <p className="text-gray-600">You don't have any tickets assigned yet. Please wait for the game organizer to assign tickets or contact them if you believe this is an error.</p>
        {onRefreshTickets && (
          <Button 
            variant="outline" 
            className="w-full mt-4 flex items-center justify-center gap-2"
            onClick={onRefreshTickets}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Tickets
          </Button>
        )}
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
      const layoutMask = ticket.layoutMask ?? ticket.layout_mask ?? 0;
      
      // Make sure layoutMask exists before processing
      if (layoutMask === undefined || layoutMask === null) {
        console.warn("Ticket without layoutMask encountered:", ticket);
        return { ...ticket, minToGo: Infinity };
      }
      
      // Process ticket grid and get progress
      const grid = processTicketLayout(ticket.numbers || [], layoutMask);
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Your Bingo Tickets ({tickets.length})</h2>
        {onRefreshTickets && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onRefreshTickets} 
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        )}
      </div>
      
      {/* Group tickets by perm (strip) */}
      {Array.from(new Set(sortedTickets.map(t => t.perm))).map(perm => (
        <div key={`perm-${perm}`} className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 bg-gray-100 p-2 rounded-md">Strip #{perm || 'Unknown'}</h3>
          <div className="grid grid-cols-1 gap-6">
            {sortedTickets
              .filter(t => t.perm === perm)
              .sort((a, b) => autoMarking ? a.minToGo - b.minToGo : (a.position || 0) - (b.position || 0))
              .map((ticket) => {
                // Handle both layoutMask and layout_mask property naming
                const layoutMask = ticket.layoutMask ?? ticket.layout_mask ?? 0;
                
                // Log detailed info about each ticket before rendering
                console.log(`Rendering ticket ${ticket.serial || 'Unknown'}:`, {
                  layoutMask,
                  hasNumbers: !!ticket.numbers && Array.isArray(ticket.numbers),
                  numbersLength: ticket.numbers?.length || 0
                });
                
                // Make sure we have a valid ticket
                if (!ticket.numbers || !Array.isArray(ticket.numbers) || ticket.numbers.length === 0) {
                  console.error("Invalid ticket data:", ticket);
                  return (
                    <div key={ticket.serial || Math.random().toString()} 
                         className="border border-red-300 rounded-lg p-4 bg-red-50">
                      <div className="text-red-600">Invalid ticket data</div>
                    </div>
                  );
                }
                
                return (
                  <div key={ticket.serial || Math.random().toString()} 
                       className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="mb-1 flex justify-between items-center text-sm text-gray-500">
                      <span>Position: {ticket.position || 'N/A'}</span>
                      {ticket.minToGo !== undefined && <span>{ticket.minToGo} to go</span>}
                    </div>
                    <BingoTicketDisplay
                      numbers={ticket.numbers || []}
                      layoutMask={layoutMask}
                      calledNumbers={calledNumbers}
                      serial={ticket.serial || 'Unknown'}
                      perm={ticket.perm || 0}
                      position={ticket.position || 0}
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
