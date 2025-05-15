
import React from 'react';
import { ClaimNotifications } from '@/components/caller';

interface ClaimLayoutProps {
  children: React.ReactNode;
  sessionId?: string | null;
  onOpenClaimSheet: () => void;
  showClaimNotifications?: boolean;
}

export const ClaimLayout: React.FC<ClaimLayoutProps> = ({
  children,
  sessionId,
  onOpenClaimSheet,
  showClaimNotifications = true
}) => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with claim notifications */}
      <header className="bg-white border-b border-gray-200 py-2 px-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gray-800">Bingo Blitz</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {showClaimNotifications && sessionId && (
            <ClaimNotifications 
              sessionId={sessionId} 
              onOpenClaimSheet={onOpenClaimSheet}
            />
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};
