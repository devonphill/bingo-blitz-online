
import React from 'react';
import { useTicketProcessor } from './useTicketProcessor';
import TicketHeaderInfo from './TicketHeaderInfo';
import TicketGrid from './TicketGrid';
import TicketProgressDisplay from './TicketProgressDisplay';
import { logWithTimestamp } from '@/utils/logUtils';

interface SimpleBingoTicketDisplayProps {
  numbers: number[];
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  perm: number;
  position?: number;
  autoMarking?: boolean;
  currentWinPattern?: string | null;
  showProgress?: boolean;
}

/**
 * Component for displaying a bingo ticket without error handling
 */
export default function SimpleBingoTicketDisplay({
  numbers,
  layoutMask,
  calledNumbers,
  serial,
  perm,
  position,
  autoMarking = true,
  currentWinPattern = "oneLine",
  showProgress = true
}: SimpleBingoTicketDisplayProps) {
  // Use the ticket processor hook to handle all ticket logic
  const {
    grid,
    markedCells,
    recentlyMarked,
    oneTGNumbers,
    progress,
    toggleMark
  } = useTicketProcessor({
    numbers,
    layoutMask,
    calledNumbers,
    serial,
    autoMarking,
    currentWinPattern
  });

  // If there's an issue with the grid, show a valid empty grid
  if (!grid || grid.length !== 3) {
    console.error(`Invalid grid for ticket ${serial}`, grid);
    return (
      <div className="flex flex-col">
        <div className="bg-red-100 text-red-800 p-2 rounded-md mb-2">
          Error displaying ticket
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array(27).fill(null).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Ticket Header with serial number and perm info */}
      <TicketHeaderInfo 
        serial={serial} 
        perm={perm} 
        position={position} 
      />
      
      {/* Grid of bingo cells */}
      <TicketGrid 
        grid={grid}
        markedCells={markedCells}
        recentlyMarked={recentlyMarked}
        oneTGNumbers={oneTGNumbers}
        calledNumbers={calledNumbers}
        autoMarking={autoMarking}
        toggleMark={toggleMark}
      />
      
      {/* Progress information */}
      <TicketProgressDisplay 
        showProgress={showProgress}
        currentWinPattern={currentWinPattern}
        progress={progress}
        oneTGNumbers={oneTGNumbers}
      />
    </div>
  );
}
