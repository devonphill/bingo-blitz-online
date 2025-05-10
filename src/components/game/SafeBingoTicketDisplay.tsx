
import React from 'react';
import TicketErrorBoundary from './TicketErrorBoundary';
import SimpleBingoTicketDisplay from './SimpleBingoTicketDisplay';

interface SafeBingoTicketDisplayProps {
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
 * Error-protected bingo ticket display component
 * Wraps the SimpleBingoTicketDisplay with an error boundary
 */
export default function SafeBingoTicketDisplay(props: SafeBingoTicketDisplayProps) {
  return (
    <TicketErrorBoundary serial={props.serial}>
      <SimpleBingoTicketDisplay {...props} />
    </TicketErrorBoundary>
  );
}
