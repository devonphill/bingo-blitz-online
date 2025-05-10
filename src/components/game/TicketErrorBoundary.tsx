
import React from 'react';
import { logWithTimestamp } from '@/utils/logUtils';

interface TicketErrorBoundaryProps {
  children: React.ReactNode;
  serial: string;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary specifically for ticket display
 */
export default class TicketErrorBoundary extends React.Component<
  TicketErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: TicketErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    logWithTimestamp(`Ticket display error for ticket ${this.props.serial}: ${error.message}`, 'error');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-red-50 p-4 border border-red-200 rounded-md">
          <p className="text-red-700">Failed to display ticket {this.props.serial}</p>
          <p className="text-sm text-red-600">There was an error rendering this ticket.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
