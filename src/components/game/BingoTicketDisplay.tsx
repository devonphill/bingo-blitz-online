
import React from 'react';
import SafeBingoTicketDisplay from './SafeBingoTicketDisplay';

/**
 * This is a wrapper component that forwards to SafeBingoTicketDisplay
 * Created to maintain backward compatibility with existing code
 */
interface BingoTicketDisplayProps {
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

export default function BingoTicketDisplay(props: BingoTicketDisplayProps) {
  return <SafeBingoTicketDisplay {...props} />;
}
