
import React, { useMemo } from 'react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';

/**
 * This is a wrapper component that forwards to SafeBingoTicketDisplay
 * Created to maintain backward compatibility with existing code
 */
interface BingoTicketDisplayProps {
  numbers: number[] | number[][];  // Allow either format
  layoutMask: number;
  calledNumbers: number[];
  serial: string;
  perm: number;
  position?: number;
  autoMarking?: boolean;
  currentWinPattern?: string | null;
  showProgress?: boolean;
}

export default function BingoTicketDisplay(props: BingoTicketDisplayProps) {
  // Convert to flat array if necessary
  const flatNumbers = useMemo(() => {
    if (!Array.isArray(props.numbers)) {
      console.error(`Invalid numbers prop in BingoTicketDisplay: ${props.numbers}`);
      return [];
    }
    
    // Check if it's already a flat array
    if (props.numbers.length > 0 && !Array.isArray(props.numbers[0])) {
      return props.numbers as number[];
    }
    
    // It's a 2D array, flatten it
    return (props.numbers as number[][]).flat().filter(n => n !== null && n !== undefined) as number[];
  }, [props.numbers]);
  
  // Log incoming data for debugging
  console.log(`BingoTicketDisplay - Rendering ticket ${props.serial}, layout mask: ${props.layoutMask}, numbers count: ${flatNumbers.length}`);
  
  return <SafeBingoTicketDisplay 
    {...props} 
    numbers={flatNumbers} 
  />;
}
