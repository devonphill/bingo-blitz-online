
import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface GameHeaderProps {
  sessionName: string;
  accessCode: string;
  activeWinPattern?: string | null;
  autoMarking: boolean;
  setAutoMarking: (value: boolean) => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
  sessionName, 
  accessCode,
  activeWinPattern,
  autoMarking,
  setAutoMarking
}) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-4">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <Button variant="ghost" className="w-full justify-start" onClick={() => window.location.href = '/dashboard'}>
                Dashboard
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1">
          <h1 className="text-xl font-bold text-bingo-primary">Bingo Blitz</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-sm text-gray-500">Session: {sessionName}</div>
            {activeWinPattern && (
              <div className="text-sm font-medium text-bingo-primary bg-bingo-primary/10 px-2 py-0.5 rounded">
                {activeWinPattern}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-marking"
              checked={autoMarking}
              onCheckedChange={setAutoMarking}
            />
            <label htmlFor="auto-marking" className="text-sm font-medium">
              Auto Marking
            </label>
          </div>
          
          <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
            Access Code: <span className="font-mono font-bold">{accessCode}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
