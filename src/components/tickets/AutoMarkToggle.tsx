
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AutoMarkToggleProps {
  autoMarking: boolean;
  setAutoMarking: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AutoMarkToggle: React.FC<AutoMarkToggleProps> = ({ 
  autoMarking, 
  setAutoMarking 
}) => {
  return (
    <div className="flex items-center space-x-2 my-4 w-fit">
      <Switch 
        id="auto-mark" 
        checked={autoMarking} 
        onCheckedChange={setAutoMarking}
      />
      <Label htmlFor="auto-mark" className="cursor-pointer">
        Auto-Mark Numbers
      </Label>
      <div className="text-sm text-gray-500 ml-2">
        {autoMarking ? "On" : "Off"}
      </div>
    </div>
  );
};
