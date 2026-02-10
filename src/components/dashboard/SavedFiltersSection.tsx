'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { SavedFilterPreset } from '@/hooks/useSavedFilters';
import type { FilterState } from '@/hooks/useFilters';

interface SavedFiltersSectionProps {
  presets: SavedFilterPreset[];
  maxReached: boolean;
  onRecallPreset: (filters: Partial<FilterState>) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (id: string, newName: string) => void;
}

export function SavedFiltersSection({
  presets,
  maxReached,
  onRecallPreset,
  onSavePreset,
  onDeletePreset,
  onRenamePreset,
}: SavedFiltersSectionProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    onSavePreset(trimmed);
    setSaveName('');
    setSaveDialogOpen(false);
  };

  const handleRenameOpen = (preset: SavedFilterPreset) => {
    setRenameTarget({ id: preset.id, name: preset.name });
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = () => {
    if (!renameTarget || !renameTarget.name.trim()) return;
    onRenamePreset(renameTarget.id, renameTarget.name.trim());
    setRenameTarget(null);
    setRenameDialogOpen(false);
  };

  return (
    <>
      {/* Separator between built-in and saved presets */}
      {(presets.length > 0 || !maxReached) && (
        <div className="w-px h-6 bg-border" />
      )}

      {/* Saved preset pills */}
      {presets.map((preset) => (
        <div key={preset.id} className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRecallPreset(preset.filters)}
            className="pr-1"
          >
            {preset.name}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-6 px-0">
                <span className="text-xs text-muted-foreground">...</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleRenameOpen(preset)}>
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeletePreset(preset.id)}
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {/* Save current filters button */}
      {!maxReached && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
          className="text-muted-foreground"
        >
          + Guardar filtros
        </Button>
      )}

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar filtros actuales</DialogTitle>
            <DialogDescription>
              Dale un nombre a esta combinacion de filtros para recordarla despues.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Ej: Visitas Ponce, Suministros pendientes..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!saveName.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar preset</DialogTitle>
            <DialogDescription>
              Escribe el nuevo nombre para este preset de filtros.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameTarget?.name ?? ''}
            onChange={(e) =>
              setRenameTarget((prev) => (prev ? { ...prev, name: e.target.value } : null))
            }
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!renameTarget?.name.trim()}>
              Renombrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
