
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PrizeSharingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isShared: boolean) => void;
  playerCount: number;
}

export default function PrizeSharingDialog({
  isOpen,
  onClose,
  onConfirm,
  playerCount
}: PrizeSharingDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Multiple Valid Claims Found</DialogTitle>
          <DialogDescription>
            {playerCount} players have valid claims. How should the prize be awarded?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          <Button onClick={() => onConfirm(true)} variant="default">
            Share Prize
          </Button>
          <Button onClick={() => onConfirm(false)} variant="outline">
            Each Gets Full Prize
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
