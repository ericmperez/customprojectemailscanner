'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReleaseTimeline } from '@/components/novedades/ReleaseTimeline';
import { CHANGELOG } from '@/lib/data/changelog';

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsNewDialog({ open, onOpenChange }: WhatsNewDialogProps) {
  const latestRelease = CHANGELOG[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>🆕 Novedades</DialogTitle>
          <DialogDescription>
            Lo nuevo en la version {latestRelease.version}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-2">
          <ReleaseTimeline releases={[latestRelease]} />
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-4">
          <Button variant="ghost" asChild>
            <Link href="/novedades" onClick={() => onOpenChange(false)}>
              Ver todo el historial
            </Link>
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
