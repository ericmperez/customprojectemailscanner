'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChecklistItem } from '@/lib/types';
import { ConfirmationDialog } from '@/components/modals/ConfirmationDialog';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return new Date(dateStr).toLocaleDateString('es-PR', {
    day: 'numeric',
    month: 'short',
  });
}

interface LicitacionChecklistProps {
  licitacionId: string;
  licitacionTitle: string;
}

export function LicitacionChecklist({ licitacionId, licitacionTitle }: LicitacionChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; itemId: string; label: string }>({
    open: false,
    itemId: '',
    label: '',
  });

  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/checklist`);
      const result = await res.json();
      if (result.success) {
        setItems(result.data);
      }
    } catch (error) {
      console.error('Error fetching checklist:', error);
    } finally {
      setLoading(false);
    }
  }, [licitacionId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleToggle = async (item: ChecklistItem) => {
    const newCompleted = !item.completed;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              completed: newCompleted,
              completed_by: newCompleted ? '...' : null,
              completed_at: newCompleted ? new Date().toISOString() : null,
            }
          : i
      )
    );

    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, completed: newCompleted }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        // Replace with server response
        setItems((prev) => prev.map((i) => (i.id === item.id ? result.data : i)));
      }
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      // Revert optimistic update
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    }
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setItems((prev) => [...prev, result.data]);
        setNewLabel('');
      }
    } catch (error) {
      console.error('Error adding checklist item:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteClick = (itemId: string, label: string) => {
    setDeleteConfirm({ open: true, itemId, label });
  };

  const executeDelete = async () => {
    const { itemId } = deleteConfirm;
    setDeleteConfirm({ open: false, itemId: '', label: '' });

    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      await fetch(`/api/licitaciones/${licitacionId}/checklist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      // Re-fetch on error
      fetchChecklist();
    }
  };

  const doneCount = items.filter((i) => i.completed).length;

  // Suppress unused var warning — title is passed to activity log on the API side
  void licitacionTitle;

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-2">Cargando checklist...</div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{doneCount}/{items.length} completados</span>
        {items.length > 0 && (
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Items */}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2 group text-sm py-0.5"
        >
          <button
            onClick={() => handleToggle(item)}
            className="mt-0.5 flex-shrink-0 text-base leading-none"
            title={item.completed ? 'Desmarcar' : 'Completar'}
          >
            {item.completed ? '✅' : '⬜'}
          </button>
          <div className="flex-1 min-w-0">
            <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
              {item.label}
            </span>
            {item.completed && item.completed_by && item.completed_at && (
              <span className="ml-2 text-xs text-muted-foreground">
                {item.completed_by} · {relativeTime(item.completed_at)}
              </span>
            )}
          </div>
          <button
            onClick={() => handleDeleteClick(item.id, item.label)}
            className="flex-shrink-0 text-xs text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      ))}

      {/* Add new item */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Agregar paso..."
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          disabled={adding}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newLabel.trim()}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {adding ? '...' : '+ Agregar'}
        </button>
      </div>

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteConfirm({ open: false, itemId: '', label: '' });
        }}
        title="Eliminar paso"
        description={`¿Eliminar "${deleteConfirm.label}" del checklist?`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={false}
        onConfirm={executeDelete}
      />
    </div>
  );
}
