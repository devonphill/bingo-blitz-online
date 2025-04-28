
import React from 'react';

export const Footer = () => {
  return (
    <footer className="py-2 px-4 bg-gray-100 text-gray-600 text-xs text-center fixed bottom-0 w-full">
      Bingo Blitz © {new Date().getFullYear()}
    </footer>
  );
};
