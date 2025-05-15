
import React from 'react';
import { SessionProvider } from '@/contexts/SessionProvider';
import { logWithTimestamp } from '@/utils/logUtils';

export const PlayerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logWithTimestamp('PlayerLayout: Rendering with SessionProvider', 'info');
  
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
};
