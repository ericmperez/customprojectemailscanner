'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ApprovalModalProps {
  open: boolean;
  action: 'approve' | 'reject' | null;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

export function ApprovalModal({ open, action, onClose, onConfirm }: ApprovalModalProps) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notas de Aprobacion</DialogTitle>
        </DialogHeader>
        <textarea
          className="w-full rounded-md border bg-background p-3 text-sm min-h-[100px] resize-y"
          placeholder="Agregue notas sobre esta decision (opcional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant={action === 'approve' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            className={action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {action === 'approve' ? '✓ Aprobar' : '✗ Rechazar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
